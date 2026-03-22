# Dev Log

## 2026-03-23

### Update: Removed stock graph dependency and added buy guidance

- Removed the stock chart section from the stock details page because chart data currently depends on a Finnhub API tier upgrade.
- Kept price, day stats, and company profile information visible so stock pages remain useful.
- Added a clear side note on the stock page explaining how to buy one share using the trade panel.
- Left the trade execution flow unchanged, including market-hours enforcement and live pricing behavior.

### Reason

- Prevent users from seeing a non-functional graph area while maintaining a complete trading workflow.

### Validation

- Confirmed the stock page renders without the chart component.
- Confirmed users still have direct buy guidance next to the trade panel.
