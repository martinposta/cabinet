// Entry point: load data.json, then the wall (desktop, tablet) or the exhibit list (phone).
// A phone is a narrow window, or a short one under a finger (a phone held sideways is ~840 × 390);
// `?mobile` forces the list, for checking it on a computer.

const data = await fetch(new URL("data.json", document.baseURI), { cache: "no-cache" }).then(r => r.json());
const phone = new URLSearchParams(location.search).has("mobile")
  || matchMedia("(max-width: 760px), (max-height: 500px) and (pointer: coarse)").matches;
if (phone) (await import("./mobile.js")).startMobile(data);
else (await import("./wallpage.js")).startWallPage(data);
