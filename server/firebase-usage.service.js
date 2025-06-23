// Servizio per metriche reali Firebase (Firestore, Storage)
import { Monitoring } from '@google-cloud/monitoring';

const monitoringClient = new Monitoring.MetricServiceClient();
const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

async function getFirestoreUsage() {
  // Metric: "firestore.googleapis.com/storage/total_bytes"
  const [timeSeries] = await monitoringClient.listTimeSeries({
    name: monitoringClient.projectPath(projectId),
    filter: 'metric.type="firestore.googleapis.com/storage/total_bytes"',
    interval: {
      endTime: { seconds: Date.now() / 1000 },
      startTime: { seconds: Date.now() / 1000 - 3600 }, // last hour
    },
    view: 'FULL',
    orderBy: 'desc',
    pageSize: 1,
  });
  const bytes = timeSeries[0]?.points[0]?.value?.int64Value || 0;
  return Number(bytes) / (1024 ** 3); // GiB
}

async function getStorageUsage() {
  // Metric: "storage.googleapis.com/storage/total_bytes"
  const [timeSeries] = await monitoringClient.listTimeSeries({
    name: monitoringClient.projectPath(projectId),
    filter: 'metric.type="storage.googleapis.com/storage/total_bytes"',
    interval: {
      endTime: { seconds: Date.now() / 1000 },
      startTime: { seconds: Date.now() / 1000 - 3600 },
    },
    view: 'FULL',
    orderBy: 'desc',
    pageSize: 1,
  });
  const bytes = timeSeries[0]?.points[0]?.value?.int64Value || 0;
  return Number(bytes) / (1024 ** 3); // GB
}

export default {
  getFirestoreUsage,
  getStorageUsage,
}; 