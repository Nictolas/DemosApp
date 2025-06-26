import fetch from 'node-fetch';

export async function getVercelUsage() {
  const url = `https://api.vercel.com/v6/usage/web?projectId=${process.env.VERCEL_PROJECT}`;
  const headers = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Vercel API error');
    const data = await res.json();
    return {
      bandwidth: data.bandwidth?.currentPeriod?.used / (1024 * 1024 * 1024) || 0,
      apiCalls: data.serverlessInvocations?.currentPeriod?.count || 0,
    };
  } catch (e) {
    return { bandwidth: 0, apiCalls: 0 };
  }
} 