// netlify/functions/eodhd-proxy.js
  const fetch = require('node-fetch');

  exports.handler = async function(event, context) {
    const { ticker } = event.queryStringParameters || {};

    if (!ticker) {
      return { statusCode: 400, body: 'Missing ticker parameter' };
    }

    const apiToken = '69a8eecc00a6a4.04467805'; // keep this secret – consider using Netlify Secrets
    const url = `https://eodhd.com/api/real-time/${encodeURIComponent(ticker)}?api_token=${apiToken}&fmt=json`;

    try {
      const res = await fetch(url, { method: 'GET' });

      if (!res.ok) {
        return { statusCode: res.status, body: `EODHD error: ${res.statusText}` };
      }

      const data = await res.json();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          // This is what enables your page to read the response
          'Access-Control-Allow-Origin': '*',
          // If you want to restrict to your Netlify domain:
          // 'Access-Control-Allow-Origin': 'https://69b73df376b54f000846d5f2--bransprojecthub.netlify.app',
        },
        body: JSON.stringify(data),
      };
    } catch (err) {
      return { statusCode: 500, body: `Fetch error: ${err.message}` };
    }
  };
  