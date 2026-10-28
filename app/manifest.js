export default function manifest() {
  return {
    name: 'SecuSim',
    short_name: 'SecuSim',
    description: 'A sandbox for learning network topologies and security policies.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: '#007a70',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
