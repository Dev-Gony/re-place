export function createLatestRequestGate() {
  let version = 0;

  return {
    begin() {
      version += 1;
      return version;
    },
    isLatest(candidate: number) {
      return candidate === version;
    },
  };
}
