// The app icon, drawn with plain shapes (no text, so no font is needed): a navy tile with a
// stack of three green coins — "savings put together". Used for the browser tab, iPhone home
// screen and Android install.
export function AppIconArt({ size }: { size: number }) {
  const coinW = Math.round(size * 0.5)
  const coinH = Math.round(size * 0.15)
  const border = Math.max(2, Math.round(size * 0.025))
  const coin = (key: number) => (
    <div
      key={key}
      style={{
        width: coinW,
        height: coinH,
        marginTop: key === 0 ? 0 : -Math.round(coinH * 0.25),
        borderRadius: coinH,
        background: "#2e8b3e",
        border: `${border}px solid #ffffff`,
        display: "flex",
      }}
    />
  )
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#1d3f57",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: Math.round(size * 0.04),
      }}
    >
      {[0, 1, 2].map(coin)}
    </div>
  )
}
