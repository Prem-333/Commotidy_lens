# Official-source register

Researched 10 October 2026. These links establish reference specifications, not a guarantee that they apply to every historical expiry. The application leaves defaults unverified until an operator confirms applicability.

| Contract | Lot grams | Quote grams | Purity | Delivery basis | Official document |
| --- | ---: | ---: | ---: | --- | --- |
| GOLDM | 100 | 10 | .995 | Ahmedabad | [August 2026 onwards](https://www.mcxindia.com/docs/default-source/about-us/gold-mini-august-2026-contract-onwards8a79913a-e8de-4136-9f0b-25d31dc163c4.pdf) |
| GOLDTEN | 10 | 10 | .999 | Ahmedabad | [July 2026 onwards](https://www.mcxindia.com/docs/default-source/about-us/gold-ten-july-2026-contract-onwards.pdf) |
| GOLDGUINEA | 8 | 8 | .999 | Ahmedabad | [July 2026 onwards](https://www.mcxindia.com/docs/default-source/about-us/gold-guinea-july-2026-contract-onwards.pdf) |
| GOLDPETAL | 1 | 1 | .999 | Mumbai | [July 2026 onwards](https://www.mcxindia.com/docs/default-source/about-us/gold-petal-july-2026-contract-onwards.pdf) |

GOLD as an optional reference is not enabled in this release. Official reference values are 1,000g lot / 10g quotation / .995 purity, with expiry-version-specific documents on the [MCX Gold page](https://www.mcxindia.com/products/bullion/gold).

## Bhavcopy

- [MCX Daily Bhavcopy](https://www.mcxindia.com/market-data/bhavcopy?slinkpage=y): user-facing download page. A functioning automated public-download endpoint was not verified, so there is no claimed automatic feed.
- [MCXCCL UDiFF Bhavcopy schema](https://www.mcxccl.com/docs/mcxccllibraries/uni/bhavcopy-file/bhavcopy-(2).pdf?sfvrsn=94985e0b_1): `TradDt`, `TckrSymb`, actual/original expiry, `SttlmPric`, `OpnPric`, `TtlTradgVol`, `OpnIntrst` and option discriminators.
- [MCXCCL UDiFF landing page](https://www.mcxccl.com/all-circulars/unified-distilled-file-formats-(udiff)): distribution documentation and format references.
- [MCX data-feed information](https://www.mcxindia.com/technology/datafeed): end-of-day Bhavcopy is distinct from streaming/delayed data services. Public availability is not a grant of redistribution rights.

The schema says traded volume is in lots and traded value is an absolute amount; legacy notional multipliers must not be guessed. This application does not use reported turnover in valuation. OI units and instrument-type enumerations need acceptance against authorized representative files. Unknown column layouts fail rather than guessing a settlement price.

## Framework references

- [FastAPI container deployment](https://fastapi.tiangolo.com/deployment/docker/)
- [Vite getting started and runtime requirements](https://vite.dev/guide/)

Dependencies are reproducibly captured in `web/package-lock.json` and `api/requirements.lock`; container base images still need release-specific digest pinning in the actual deployment environment.
