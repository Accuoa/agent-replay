// CLI adapter for the toy agent.
// The CLI dynamically imports this module and expects:
// - default export: agent metadata { name, version }
// - export runAgent(input, wrapper) async
// - export backends: map of boundary name -> async backend function
export { toyBackends as backends, runToyAgent as runAgent } from './toy-agent.mjs';
export default { name: 'toy', version: '1.0' };
