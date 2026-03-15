// netlify/functions/cmc.js
export async function handler(event, context) {
  try {
    const CMC_API_KEY = process.env.cmcApiKeys;

    const url = 'https://pro-api.coinmarketcap.com/v2/tools/price-conversion'
      + '?amount=1&id=2781&convert=CAD';

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        'Accept': 'application/json',
      },
    });

    const data = await res.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'CMC fetch failed' }),
    };
  }
}
