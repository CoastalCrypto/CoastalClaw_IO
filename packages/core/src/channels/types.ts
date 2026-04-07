export type ChannelType = 'telegram' | 'discord' | 'slack' | 'zapier'

export interface Channel {
  send(message: string): Promise<void>
}

export interface ChannelRecord {
  id: string
  type: ChannelType
  name: string
  config: string   // JSON blob
  enabled: number
  createdAt: number
  updatedAt: number
}
