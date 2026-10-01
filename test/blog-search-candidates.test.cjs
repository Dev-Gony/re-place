const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
const moduleUrl = pathToFileURL(
  path.join(root, "lib/blog-search-candidates.mjs"),
).href;

async function subject() {
  return import(moduleUrl);
}

test("builds at most five deduplicated search candidates from recent posts", async () => {
  const { generateSearchCandidates } = await subject();
  const posts = [
    { title: "시청역 상견례 한우 코스 맛집 후기", categories: ["서울 맛집"] },
    { title: "명동 마카롱 디저트 카페 추천", categories: ["서울 카페"] },
    { title: "시청역 한우 데이트 코스 방문기", categories: ["서울 맛집"] },
    { title: "제주 함덕 닭발 맛집 솔직후기", categories: ["제주 맛집"] },
    { title: "성수 파스타 데이트 레스토랑", categories: ["서울 맛집"] },
    { title: "홍대 브런치 카페 주말 방문", categories: ["서울 카페"] },
  ];

  const candidates = generateSearchCandidates(posts);

  assert.ok(candidates.length > 1);
  assert.ok(candidates.length <= 5);
  assert.equal(new Set(candidates.map((item) => item.toLowerCase())).size, candidates.length);
  assert.ok(candidates.every((item) => item.split(/\s+/).length >= 2));
  assert.ok(candidates.every((item) => item.split(/\s+/).length <= 3));
});

test("does not copy the complete post title and removes generic stop words", async () => {
  const { generateSearchCandidates } = await subject();
  const title = "강남 파스타 맛집 솔직 후기 추천";
  const [candidate] = generateSearchCandidates([
    { title, categories: ["맛집"] },
  ]);

  assert.ok(candidate);
  assert.notEqual(candidate.toLowerCase(), title.toLowerCase());
  assert.doesNotMatch(candidate, /후기|추천|솔직/);
});

test("uses recent ten posts only and safely handles sparse evidence", async () => {
  const { generateSearchCandidates } = await subject();
  const posts = Array.from({ length: 12 }, (_, index) => ({
    title: index < 10 ? `지역${index} 식당 메뉴${index}` : `제외지역${index} 제외메뉴${index}`,
    categories: ["맛집"],
  }));

  const candidates = generateSearchCandidates(posts);
  assert.ok(candidates.every((item) => !item.includes("제외지역")));
  assert.deepEqual(generateSearchCandidates([]), []);
  assert.deepEqual(generateSearchCandidates(null), []);
});

test("respects explicit lower max and never exceeds five", async () => {
  const { generateSearchCandidates } = await subject();
  const posts = Array.from({ length: 8 }, (_, index) => ({
    title: `지역${index} 식당${index} 메뉴${index}`,
    categories: ["맛집"],
  }));

  assert.equal(generateSearchCandidates(posts, { maxQueries: 2 }).length, 2);
  assert.ok(generateSearchCandidates(posts, { maxQueries: 99 }).length <= 5);
});
