import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export interface CoralMention {
  threadId?: string;
  sender?: string;
  text: string;
}

export interface CoralAgentContext {
  waitForMention(maxWaitMs?: number): Promise<CoralMention | null>;
  waitForAgent(
    agentName: string,
    maxWaitMs?: number
  ): Promise<CoralMention | null>;
  createThread(name: string, participants: Array<string>): Promise<string>;
  send(
    content: string,
    threadId: string,
    mentions?: Array<string>
  ): Promise<void>;
  reply(mention: CoralMention, content: string): Promise<void>;
}

interface ToolNames {
  waitForMention: string;
  waitForAgent: string;
  createThread: string;
  sendMessage: string;
}

export class CoralMcpAgent {
  private client: Client | undefined;
  private tools: ToolNames | undefined;

  constructor(
    private readonly connectionUrl: string,
    private readonly agentName: string,
    private readonly version = '0.1.0'
  ) {}

  async connect(): Promise<void> {
    this.client = new Client(
      { name: this.agentName, version: this.version },
      { capabilities: {} }
    );
    const transport = new StreamableHTTPClientTransport(
      new URL(this.connectionUrl)
    ) as Transport;
    await this.client.connect(transport);
    const result = await this.client.listTools();
    const names = result.tools.map((tool) => tool.name);
    this.tools = {
      waitForMention:
        names.find((name) => name.includes('wait_for_mention')) ??
        'coral_wait_for_mention',
      waitForAgent:
        names.find((name) => name.includes('wait_for_agent')) ??
        'coral_wait_for_agent',
      createThread:
        names.find((name) => name.includes('create_thread')) ??
        'coral_create_thread',
      sendMessage:
        names.find((name) => name.endsWith('send_message')) ??
        'coral_send_message',
    };
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
  }

  async waitForMention(maxWaitMs = 30_000): Promise<CoralMention | null> {
    return this.callMentionTool(this.requireTools().waitForMention, {
      maxWaitMs,
      currentUnixTime: Date.now(),
    });
  }

  async waitForAgent(
    agentName: string,
    maxWaitMs = 30_000
  ): Promise<CoralMention | null> {
    return this.callMentionTool(this.requireTools().waitForAgent, {
      agentName,
      maxWaitMs,
      currentUnixTime: Date.now(),
    });
  }

  async createThread(
    threadName: string,
    participantNames: Array<string>
  ): Promise<string> {
    const result = await this.requireClient().callTool({
      name: this.requireTools().createThread,
      arguments: { threadName, participantNames },
    });
    const text = contentText(result.content);
    try {
      const data = JSON.parse(text) as {
        thread?: { id?: string };
        threadId?: string;
        id?: string;
      };
      return data.thread?.id ?? data.threadId ?? data.id ?? text;
    } catch {
      return text;
    }
  }

  async sendMessage(
    content: string,
    threadId: string,
    mentions: Array<string> = []
  ): Promise<void> {
    await this.requireClient().callTool({
      name: this.requireTools().sendMessage,
      arguments: { threadId, content, mentions },
    });
  }

  private async callMentionTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<CoralMention | null> {
    const result = await this.requireClient().callTool({
      name,
      arguments: args,
    });
    const text = contentText(result.content);
    if (!text || text === 'null' || text === '{}' || text === '[]') return null;
    return parseMention(text);
  }

  private requireClient(): Client {
    if (!this.client) throw new Error('Coral agent is not connected');
    return this.client;
  }

  private requireTools(): ToolNames {
    if (!this.tools) throw new Error('Coral tools have not been discovered');
    return this.tools;
  }
}

export async function startCorifyAgent(
  agentName: string,
  run: (context: CoralAgentContext) => Promise<void>
): Promise<void> {
  const connectionUrl = process.env.CORAL_CONNECTION_URL;
  if (!connectionUrl)
    throw new Error(
      'CORAL_CONNECTION_URL is required; Coral injects it when launching the agent'
    );

  const agent = new CoralMcpAgent(
    connectionUrl,
    process.env.AGENT_NAME ?? agentName
  );
  await agent.connect();
  const context: CoralAgentContext = {
    waitForMention: (maxWaitMs) => agent.waitForMention(maxWaitMs),
    waitForAgent: (name, maxWaitMs) => agent.waitForAgent(name, maxWaitMs),
    createThread: (name, participants) =>
      agent.createThread(name, participants),
    send: (content, threadId, mentions) =>
      agent.sendMessage(content, threadId, mentions),
    reply: async (mention, content) => {
      if (!mention.threadId)
        throw new Error('Cannot reply to a mention without threadId');
      await agent.sendMessage(
        content,
        mention.threadId,
        mention.sender ? [mention.sender] : []
      );
    },
  };

  process.once('SIGINT', () => {
    void agent.disconnect().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void agent.disconnect().finally(() => process.exit(0));
  });

  await run(context);
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter(
      (item): item is { type: string; text?: string } =>
        typeof item === 'object' && item !== null && 'type' in item
    )
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join(' ')
    .trim();
}

function parseMention(text: string): CoralMention {
  try {
    const data = JSON.parse(text) as {
      threadId?: string;
      sender?: string;
      senderName?: string;
      text?: string;
      content?: string;
    };
    const mention: CoralMention = { text: data.text ?? data.content ?? text };
    if (data.threadId) mention.threadId = data.threadId;
    const sender = data.sender ?? data.senderName;
    if (sender) mention.sender = sender;
    return mention;
  } catch {
    return { text };
  }
}
