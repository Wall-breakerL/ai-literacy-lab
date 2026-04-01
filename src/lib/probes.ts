import { Probe, Dimension, ConversationMessage } from '@/types';

// Probe state
let probes: Probe[] = [];
let conversationHistory: ConversationMessage[] = [];
let triggeredDimensions: Set<Dimension> = new Set();
let userFramePriority: string[] = []; // 用户说出的软约束优先级

export function resetProbes() {
  probes = [];
  conversationHistory = [];
  triggeredDimensions = new Set();
  userFramePriority = [];
}

export function addProbe(
  type: Probe['type'],
  trigger: string,
  signal: string,
  dimensions: Dimension[],
  raw: string
) {
  const probe: Probe = {
    type,
    trigger,
    signal,
    dimensions,
    raw,
    timestamp: Date.now(),
  };
  probes.push(probe);
  dimensions.forEach((d) => triggeredDimensions.add(d));
  console.log('[Probe]', type, trigger, signal, dimensions);
}

export function addMessage(role: 'agent' | 'user', content: string) {
  conversationHistory.push({
    role,
    content,
    timestamp: Date.now(),
  });
}

export function setFramePriority(priority: string[]) {
  userFramePriority = priority;
  triggeredDimensions.add('FAA.Frame');
}

export function getProbes(): Probe[] {
  return probes;
}

export function getConversationHistory(): ConversationMessage[] {
  return conversationHistory;
}

export function getTriggeredDimensions(): Set<Dimension> {
  return triggeredDimensions;
}

export function getFramePriority(): string[] {
  return userFramePriority;
}

export function hasDimension(dim: Dimension): boolean {
  return triggeredDimensions.has(dim);
}

export function getDimensionCount(): number {
  return triggeredDimensions.size;
}

export function getCoreDimensionsTriggered(): boolean {
  return triggeredDimensions.has('FAA.Frame') && triggeredDimensions.has('FAA.Synthesize');
}
