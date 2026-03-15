// netlify/functions/cmc-fx.js
export default async (request) => {
    try {
        // Rotate keys (same logic as cmc-quote.js)
        const keys = [
            process.env.CMC_KEY_1,
            process.env.CMC_KEY_2,
        ].filter(Boolean);

        if (keys.length === 0) {
            return new Response(JSON.stringify({ error: "No API keys configured" }), { status: 500 });
        }

        const idx = Math.floor(Date.now() / 60000) % keys.length;
        const key = keys[idx];

        // USD to CAD conversion (ID 2781 is USD)
        const apiUrl = `https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&id=2781&convert=CAD`;

        const res = await fetch(apiUrl, {
            headers: {
                "X-CMC_PRO_API_KEY": key,
                Accept: "application/json",
            },
        });

        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            return new Response(JSON.stringify({ error: `CoinMarketCap error: ${res.status} ${txt}` }), {
                status: res.status,
                headers: { "Content-Type": "application/json" },
            });
        }

        const data = await res.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config = {
    path: "/api/cmc-fx",
};
