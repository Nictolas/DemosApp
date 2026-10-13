const crypto = require('crypto');
const redisCache = require('./redisCache');

const TICKET_TTL_SECONDS = 5 * 60;
const GET_AND_DELETE_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if value then
  redis.call("DEL", KEYS[1])
end
return value
`;

function ticketKey(ticket) {
  if (typeof ticket !== 'string' || ticket.length < 32) {
    throw new Error('Ticket registrazione non valido');
  }
  const digest = crypto.createHash('sha256').update(ticket, 'utf8').digest('hex');
  return `registration:exchange:${digest}`;
}

async function getAndDelete(client, key) {
  if (typeof client.getdel === 'function') return client.getdel(key);
  if (typeof client.eval !== 'function') {
    throw new Error('Redis GETDEL o EVAL richiesto per il ticket registrazione');
  }
  return client.eval(GET_AND_DELETE_SCRIPT, [key], []);
}

async function createRegistrationTicket({ userId }, client = redisCache.getClient()) {
  if (!client) throw new Error('Redis richiesto per completare la registrazione CIE');
  if (!userId) throw new Error('userId obbligatorio');

  const ticket = crypto.randomBytes(32).toString('base64url');
  await client.set(
    ticketKey(ticket),
    JSON.stringify({ userId: String(userId), createdAt: Date.now() }),
    { ex: TICKET_TTL_SECONDS }
  );
  return ticket;
}

async function consumeRegistrationTicket(ticket, client = redisCache.getClient()) {
  if (!client) throw new Error('Redis richiesto per completare la registrazione CIE');
  const raw = await getAndDelete(client, ticketKey(ticket));
  if (raw == null) throw new Error('Ticket registrazione non trovato, scaduto o gia utilizzato');

  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed?.userId) throw new Error('Ticket registrazione corrotto');
  return { userId: String(parsed.userId) };
}

module.exports = {
  TICKET_TTL_SECONDS,
  createRegistrationTicket,
  consumeRegistrationTicket,
};
