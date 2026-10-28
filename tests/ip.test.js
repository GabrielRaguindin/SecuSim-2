import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IP_CLASSES, ipClassOf, isPrivateIp, networkOf, broadcastOf, describeIp, validateHostIp, nextHostIp, groupByNetwork, isValidIPv4,
} from '../lib/ip.js';

test('the class comes from the first number', () => {
  const cases = { '1.0.0.1': 'A', '126.1.1.1': 'A', '127.0.0.1': 'loopback', '128.1.1.1': 'B', '191.255.1.1': 'B', '192.0.2.1': 'C', '223.1.1.1': 'C', '224.0.0.5': 'D', '239.1.1.1': 'D', '240.1.1.1': 'E', '255.1.1.1': 'E', '0.1.2.3': 'reserved', 'nope': 'invalid', '1.2.3': 'invalid' };
  for (const [ip, cls] of Object.entries(cases)) assert.equal(ipClassOf(ip), cls, ip);
});

test('the class table agrees with the classifier', () => {
  for (const info of Object.values(IP_CLASSES)) {
    assert.equal(ipClassOf(`${info.first[0]}.1.1.1`), info.id, `${info.id} lower edge`);
    assert.equal(ipClassOf(`${info.first[1]}.1.1.1`), info.id, `${info.id} upper edge`);
    assert.equal(ipClassOf(info.autoPrefix + 1), info.id, `${info.id} auto prefix is in its own class`);
    assert.equal(ipClassOf(info.example), info.id);
    assert.equal(isPrivateIp(info.example), true, `${info.id} example is private`);
    assert.equal(validateHostIp(info.example), null, `${info.id} example is a valid host`);
  }
});

test('private ranges', () => {
  for (const ip of ['10.0.0.1', '10.255.1.1', '172.16.0.1', '172.31.255.1', '192.168.0.1', '192.168.255.1']) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['11.0.0.1', '172.15.0.1', '172.32.0.1', '192.167.0.1', '192.169.0.1', '8.8.8.8', 'bad']) assert.equal(isPrivateIp(ip), false, ip);
});

test('network and broadcast addresses follow the class mask', () => {
  assert.equal(networkOf('10.20.30.40'), '10.0.0.0');
  assert.equal(broadcastOf('10.20.30.40'), '10.255.255.255');
  assert.equal(networkOf('172.16.30.40'), '172.16.0.0');
  assert.equal(broadcastOf('172.16.30.40'), '172.16.255.255');
  assert.equal(networkOf('192.168.1.77'), '192.168.1.0');
  assert.equal(broadcastOf('192.168.1.77'), '192.168.1.255');
  assert.equal(networkOf('224.0.0.1'), null);
  assert.equal(networkOf('garbage'), null);
});

test('describeIp gathers the details a learner needs', () => {
  assert.deepEqual(describeIp('172.16.4.9'), { class: 'B', label: 'Class B', private: true, network: '172.16.0.0', broadcast: '172.16.255.255', mask: '255.255.0.0', prefixLength: 16 });
  assert.equal(describeIp('8.8.8.8').private, false);
  assert.equal(describeIp('224.0.0.1'), null);
});

test('host addresses: the ones a device can’t have are refused with a reason', () => {
  const ok = ['10.0.0.1', '10.255.255.254', '172.16.0.1', '172.16.255.254', '192.168.1.1', '192.168.1.254', '8.8.8.8'];
  for (const ip of ok) assert.equal(validateHostIp(ip), null, ip);
  assert.match(validateHostIp('10.0.0.0'), /network address/);
  assert.match(validateHostIp('10.255.255.255'), /broadcast/);
  assert.match(validateHostIp('172.16.0.0'), /network address/);
  assert.match(validateHostIp('172.16.255.255'), /broadcast/);
  assert.match(validateHostIp('192.168.1.0'), /network address/);
  assert.match(validateHostIp('192.168.1.255'), /broadcast/);
  assert.match(validateHostIp('127.0.0.1'), /loopback/);
  assert.match(validateHostIp('0.0.0.1'), /start(ing)? with 0/);
  assert.match(validateHostIp('224.0.0.1'), /multicast/);
  assert.match(validateHostIp('250.0.0.1'), /reserved/);
  // a "host-looking" address in a bigger network is fine: 10.0.1.0 is a host in 10.0.0.0/8
  assert.equal(validateHostIp('10.0.1.0'), null);
  assert.equal(validateHostIp('172.16.1.0'), null);
});

test('nextHostIp picks the first free address in the class range', () => {
  assert.equal(nextHostIp([], 'A'), '10.0.0.1');
  assert.equal(nextHostIp([], 'B'), '172.16.0.1');
  assert.equal(nextHostIp([], 'C'), '192.168.1.1');
  assert.equal(nextHostIp(['192.168.1.1', '192.168.1.2', '192.168.1.4'], 'C'), '192.168.1.3');
  assert.equal(nextHostIp(['10.0.0.1'], 'C'), '192.168.1.1', 'other classes do not interfere');
  assert.equal(nextHostIp([], 'Z'), '192.168.1.1', 'unknown classes fall back to C');
  const full = Array.from({ length: 254 }, (_, i) => `192.168.1.${i + 1}`);
  assert.equal(nextHostIp(full, 'C'), '', 'a full range returns nothing');
  assert.ok(isValidIPv4(nextHostIp([], 'A')));
});

test('groupByNetwork organises devices by class, then network', () => {
  const n = (id, ip) => ({ id, name: id, ip });
  const { groups, unassigned } = groupByNetwork([
    n('p1', '192.168.1.5'), n('p2', '10.0.0.7'), n('p3', '192.168.1.9'), n('p4', '172.16.0.2'), n('p5', '192.168.0.4'), n('p6', ''), n('p7', '224.0.0.9'),
  ]);
  assert.deepEqual(groups.map((g) => [g.class, g.network]), [['A', '10.0.0.0'], ['B', '172.16.0.0'], ['C', '192.168.0.0'], ['C', '192.168.1.0'], [null, null]]);
  assert.deepEqual(groups[3].nodes.map((x) => x.id), ['p1', 'p3']);
  assert.deepEqual(unassigned.map((x) => x.id), ['p6']);
  assert.equal(groups[0].mask, '255.0.0.0');
  assert.deepEqual(groupByNetwork([]), { groups: [], unassigned: [] });
});
