import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const temp = mkdtempSync(join(tmpdir(), 'muscle-memory-integration-'));
const home = join(temp, 'home');
mkdirSync(home, { recursive: true });
process.env.HOME = home;

const mod = await import('/tmp/muscle-memory-package-integration.mjs?t=' + Date.now());
const handlers = {};
const commands = {};
const registered = {};
mod.default({
  capabilities: { tools: true, commands: true, events: { tools: true, lifecycle: true } },
  events: { on(name, fn) { handlers[name] = fn; return () => {}; } },
  commands: { register(spec) { commands[spec.id] = spec; return () => {}; } },
  tools: { register(spec) { registered[spec.name] = spec; return () => {}; } },
});
if (!handlers.tool_start || !handlers.conversation_close || !commands['muscle-memory']) throw new Error('expected handlers/command missing');
const readTool = registered.muscle_memory_skill_read;
const writeTool = registered.muscle_memory_skill_write;
if (!readTool || !writeTool) throw new Error('expected read/write tools missing');
if (readTool.requiresApproval !== false) throw new Error('muscle_memory_skill_read must be read-only/no-approval');
if (writeTool.requiresApproval !== true) throw new Error('muscle_memory_skill_write must be approval-gated');

function emit(toolName, args, conversationId) {
  handlers.tool_start({ toolName, args, conversationId, agentId: 'demo-agent', toolCallId: Math.random().toString(36).slice(2) });
}
for (const conv of ['a', 'a', 'b']) {
  emit('exec_command', { cmd: 'cd /tmp/demo/project && npm run validate' }, conv);
  emit('exec_command', { cmd: 'cd /tmp/demo/project && npm run validate' }, conv);
}
handlers.conversation_close({ conversationId: 'a', agentId: 'demo-agent', reason: 'test', toolCallCount: 6, messageCount: 10, durationMs: 1234 });
const out = await commands['muscle-memory'].run();
const text = out.output || '';
console.log(text);
console.log('read-tool approval:', readTool.requiresApproval === false ? 'no' : 'yes');
console.log('write-tool approval:', writeTool.requiresApproval === true ? 'yes' : 'no');
if (!/(muscle-memory — 6 reps observed|6 reps observed · tools exec_command:6)/.test(text)) throw new Error('rep count missing');
if (!/npm run validate/.test(text)) throw new Error('exec_command template did not show as candidate');
if (!/mature (skill )?candidates/.test(text)) throw new Error('candidate summary missing');
const eventsOut = await commands['muscle-memory'].run({ argv: ['events'] });
if (!/no muscle-memory review events yet/.test(eventsOut.output || '')) throw new Error('events subcommand missing');
