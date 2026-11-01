const names = ["minsu", "haeun", "seoyeon", "jihun", "doyeon", "jiwoo", "dain", "minho", "taehyun", "yuna"];
const character = key => `/assets/characters/${key}.png`;
export const hm = {
  ...Object.fromEntries(
    names.map((key) => [key, character(key)]),
  ),
  chars: [
    ["haeun", 812, 312],
    ["minsu", 892, 557],
    ["yuna", 1100, 637],
    ["doyeon", 1413, 500],
    ["dain", 1320, 255],
    ["taehyun", 1720, 835],
    ["jiwoo", 992, 893],
    ["minho", 495, 560],
  ].map(([key, x, y]) => ({
    img: character(key),
    style: {
      position: "absolute",
      left: x / 20.48 + "%",
      top: y / 10.96 + "%",
      width: "3.6%",
      aspectRatio: "36/56",
      transform: "translate(-50%,-78%)",
    },
  })),
  bubbles: [
    [892, 557, "mute", "소리에 예민해요", true],
    [1320, 255, "rest", "조금 쉬어요", false],
    [1100, 637, "phone", "통화 중", false],
  ].map(([x, y, icon, text, alert]) => ({
    icon: "/assets/icons/" + icon + ".png",
    text,
    style: {
      position: "absolute",
      left: x / 20.48 + "%",
      top: y / 10.96 + "%",
      transform: "translate(-50%,-260%)",
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 7px",
      background: alert ? "#fff0f1" : "#fffdf8",
      border: "2px solid " + (alert ? "#f1b3ba" : "#ded1bb"),
      color: alert ? "#cf3646" : "#2e2a44",
      borderRadius: 7,
      font: "10.5px Galmuri11",
      whiteSpace: "nowrap",
      boxShadow: "0 2px 0 rgba(46,36,51,.18)",
    },
  })),
};
