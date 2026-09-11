export type JobStatus = "active" | "paused" | "cancelled";

export type JobRecord = {
  id: string;
  ownerId: string;
  scope: string;
  name: string;
  schedule: string;
  status: JobStatus;
  createdAt: string;
};

export type JobOccurrenceStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type OutboxStatus = "pending" | "delivered" | "failed" | "unknown";
