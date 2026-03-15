// netlify/functions/cmc-quote.js
export default async (request) => {
    try {
        const url = new URL(request.url);
        const symbol = url.searchParams.get("symbol");

        if (!symbol || typeof symbol !== "string" || symbol.length > 20) {
            return new Response(JSON.stringify({ error: "Missing or invalid symbol" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Rotate keys (same logic as your frontend)
        const keys = [
            process.env.CMC_KEY_1,
            process.env.CMC_KEY_2,
            // add more if needed later
        ].filter(Boolean);

        if (keys.length === 0) {
            return new Response(JSON.stringify({ error: "No API keys configured" }), { status: 500 });
        }

        // simple round-robin using the minute of the hour
        const idx = Math.floor(Date.now() / 60000) % keys.length;
        const key = keys[idx];

        const apiUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(
            symbol
        )}&convert=USD`;

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
    path: "/api/cmc-quote",
};