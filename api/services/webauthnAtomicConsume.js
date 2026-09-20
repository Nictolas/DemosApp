const GET_AND_DELETE_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if value then
  redis.call("DEL", KEYS[1])
end
return value
`;

async function atomicGetAndDelete(client, key) {
  if (!client) {
    throw new Error('Client Redis richiesto');
  }

  if (typeof client.getdel === 'function') {
    return client.getdel(key);
  }

  if (typeof client.eval !== 'function') {
    throw new Error('Redis GETDEL o EVAL richiesto per consumo challenge WebAuthn');
  }

  return client.eval(GET_AND_DELETE_SCRIPT, [key], []);
}

module.exports = {
  atomicGetAndDelete
};
