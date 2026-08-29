export default {
  serverUrl: process.env.DIFFBOARD_SERVER_URL ?? "http://localhost:4300",
  baseBranch: "main",
  threshold: 0.1,
  viewports: [
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ],
  targets: [{ name: "home", url: "http://localhost:3000/" }],
};
