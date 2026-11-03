if (
  Number(process.versions.node.split(".")[0]) < 22 ||
  (Number(process.versions.node.split(".")[0]) === 22 &&
    Number(process.versions.node.split(".")[1]) < 13)
) {
  console.error(
    "Seshachandra Creations requires Node.js >=22.13.0. Install Node 22 LTS or newer.",
  );
  process.exit(1);
}
