export interface IncidentRecord {
  timestamp: number;
  userId: string;
  ipAddress?: string;
  country?: string;
}

export class IncidentDamper {
  private records: IncidentRecord[] = [];
  private burstThreshold: number;
  private burstWindowMs: number;
  private activeBurstMessageId: number | null = null;
  private activeBurstChatId: string | number | null = null;

  constructor(options?: { burstThreshold?: number; burstWindowSeconds?: number }) {
    this.burstThreshold = options?.burstThreshold ?? 4;
    this.burstWindowMs = (options?.burstWindowSeconds ?? 20) * 1000;
  }

  /**
   * Records an incident and assesses if the system is currently under a burst attack
   */
  recordIncident(data: {
    userId: string;
    ipAddress?: string;
    country?: string;
  }): {
    isBurst: boolean;
    batchCount: number;
    activeBurstMessageId: number | null;
    activeBurstChatId: string | number | null;
    topCountries: string[];
  } {
    const now = Date.now();
    this.records.push({
      timestamp: now,
      userId: data.userId,
      ipAddress: data.ipAddress,
      country: data.country,
    });

    // Prune records older than the burst window
    this.records = this.records.filter((r) => now - r.timestamp <= this.burstWindowMs);

    const isBurst = this.records.length >= this.burstThreshold;

    // Collect top countries involved in the burst
    const countryCounts = new Map<string, number>();
    for (const r of this.records) {
      if (r.country) {
        countryCounts.set(r.country, (countryCounts.get(r.country) || 0) + 1);
      }
    }
    const topCountries = Array.from(countryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country, count]) => `${country} (${count})`);

    // Reset burst message if no longer in burst
    if (!isBurst) {
      this.activeBurstMessageId = null;
      this.activeBurstChatId = null;
    }

    return {
      isBurst,
      batchCount: this.records.length,
      activeBurstMessageId: this.activeBurstMessageId,
      activeBurstChatId: this.activeBurstChatId,
      topCountries,
    };
  }

  /**
   * Sets the message ID of the live aggregated burst message
   */
  setActiveBurstMessage(chatId: string | number, messageId: number): void {
    this.activeBurstChatId = chatId;
    this.activeBurstMessageId = messageId;
  }

  reset(): void {
    this.records = [];
    this.activeBurstMessageId = null;
    this.activeBurstChatId = null;
  }
}
