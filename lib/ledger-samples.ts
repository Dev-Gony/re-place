// RPL-063/065: 페르소나 샘플 시트. 실존 인물·실제 캠페인이 아닌 테스트용 가상 데이터다.
// 날짜는 오늘 기준 상대값으로 생성해 언제 열어도 같은 진단 결과가 나온다.

export type PersonaId = "office-blogger" | "multi-channel" | "points-student" | "small-seller";
export type Perspective = "creator" | "payer";

export type PersonaSample = {
  id: PersonaId;
  label: string;
  summary: string;
  perspective: Perspective;
  build: (todayKey: string) => string;
  /** RPL-065 E2E와 단위 테스트가 확인하는 기대 진단 결과 */
  expected: {
    overdueUnpublished: number;
    dueSoonUnpublished: number;
    paymentOverdue: number;
    overdueOutstanding: number;
    pendingOutstanding: number;
    cancelledRows: number;
    needsReview: number;
    duplicates: number;
  };
};

function shift(todayKey: string, offset: number) {
  const date = new Date(`${todayKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

const p2 = (value: number) => String(value).padStart(2, "0");

const fmt = {
  slash: (t: string, o: number) => {
    const { m, d } = shift(t, o);
    return `${m}/${d}`;
  },
  dotFull: (t: string, o: number) => {
    const { y, m, d } = shift(t, o);
    return `${y}.${p2(m)}.${p2(d)}`;
  },
  korean: (t: string, o: number) => {
    const { m, d } = shift(t, o);
    return `${m}월 ${d}일`;
  },
  slashFull: (t: string, o: number) => {
    const { y, m, d } = shift(t, o);
    return `${y}/${p2(m)}/${p2(d)}`;
  },
  dotShort: (t: string, o: number) => {
    const { y, m, d } = shift(t, o);
    return `${String(y).slice(2)}.${p2(m)}.${p2(d)}`;
  },
};

const tsv = (rows: string[][]) => rows.map((row) => row.join("\t")).join("\n");

export const PERSONA_SAMPLES: PersonaSample[] = [
  {
    id: "office-blogger",
    label: "직장인 맛집 블로거",
    summary: "방문형 맛집 위주, 연도 없는 날짜, 원고료 거의 없음",
    perspective: "creator",
    build: (t) =>
      tsv([
        ["업체명", "플랫폼", "방문일", "포스팅 마감", "포스팅 URL", "제공 내역", "비고"],
        ["성수 파스타집", "리뷰노트", fmt.slash(t, -10), fmt.slash(t, -3), "https://blog.naver.com/demo_a/101", "2인 파스타 세트 (5만원 상당)", ""],
        ["연남 브런치 카페", "디너의여왕", fmt.slash(t, -6), fmt.slash(t, -1), "", "브런치 2인", "퇴근 후 작성 예정"],
        ["합정 이자카야", "강남맛집", fmt.slash(t, -2), fmt.slash(t, 2), "", "사케 코스 (8만원 상당)", ""],
        ["망원 베이커리", "리뷰플레이스", fmt.slash(t, -20), fmt.slash(t, -12), "blog.naver.com/demo_a/102", "빵 세트", ""],
        ["을지로 노포", "리뷰노트", "-", fmt.slash(t, -8), "", "2인 식사", "미선정"],
        ["홍대 디저트 바", "미블", fmt.slash(t, 3), fmt.slash(t, 10), "", "디저트 플래터", ""],
      ]),
    expected: {
      overdueUnpublished: 1,
      dueSoonUnpublished: 1,
      paymentOverdue: 0,
      overdueOutstanding: 0,
      pendingOutstanding: 0,
      cancelledRows: 1,
      needsReview: 0,
      duplicates: 0,
    },
  },
  {
    id: "multi-channel",
    label: "숏폼·블로그 다채널 크리에이터",
    summary: "원고료·페이백이 많고 금액 표기가 제각각, 부분 입금이 섞임",
    perspective: "creator",
    build: (t) =>
      tsv([
        ["캠페인", "채널", "업로드 마감", "링크", "원고료", "지급예정일", "입금액", "정산"],
        ["비건 단백질바", "인스타 릴스", fmt.dotFull(t, -14), "https://www.instagram.com/reel/demoB1", "15만", fmt.dotFull(t, -4), "", "X"],
        ["무선 이어폰", "유튜브 쇼츠", fmt.dotFull(t, -20), "https://youtube.com/shorts/demoB2", "300,000원", fmt.dotFull(t, -10), "300000", "O"],
        ["홈카페 원두", "블로그", fmt.dotFull(t, -9), "https://blog.naver.com/demo_b/103", "5만", fmt.dotFull(t, -2), "30,000", "부분입금"],
        ["캠핑 의자", "블로그", fmt.dotFull(t, -2), "", "3.5만", fmt.dotFull(t, 20), "", "대기"],
        ["스킨케어 세트", "인스타 릴스", fmt.dotFull(t, -5), "https://instagram.com/p/demoB5", "80000", "", "", ""],
        ["러닝화", "유튜브 쇼츠", fmt.dotFull(t, 5), "", "20만", "익월 10일", "", "대기"],
      ]),
    expected: {
      overdueUnpublished: 1,
      dueSoonUnpublished: 0,
      paymentOverdue: 2,
      overdueOutstanding: 170_000,
      pendingOutstanding: 485_000,
      cancelledRows: 0,
      needsReview: 1,
      duplicates: 0,
    },
  },
  {
    id: "points-student",
    label: "포인트·제공형 위주 대학생",
    summary: "URL 칸을 자주 비우고, 미선정 행을 지우지 않음",
    perspective: "creator",
    build: (t) =>
      [
        "제품,사이트,마감,url,포인트,메모",
        `수분크림,리뷰어스,${fmt.korean(t, -4)},,3000P,`,
        `텀블러,미블,${fmt.slashFull(t, -1)},https://blog.naver.com/demo_c/104,제공,`,
        `핸드크림,리뷰플레이스,${fmt.korean(t, -7)},,2000P,미선정`,
        `립밤,리뷰어스,${fmt.slashFull(t, 1)},,1000P,`,
        `샴푸,미블,이번주 금요일,,제공,"마감 확인, 다시 보기"`,
        `비타민,리뷰어스,${fmt.korean(t, -3)},https://blog.naver.com/demo_c/105,5000P,`,
      ].join("\n"),
    expected: {
      overdueUnpublished: 1,
      dueSoonUnpublished: 1,
      paymentOverdue: 0,
      overdueOutstanding: 0,
      pendingOutstanding: 0,
      cancelledRows: 1,
      needsReview: 1,
      duplicates: 0,
    },
  },
  {
    id: "small-seller",
    label: "소규모 셀러·체험단 모집자",
    summary: "리뷰어에게 원고료를 주는 쪽. 중복 행과 URL 아닌 메모가 섞임",
    perspective: "payer",
    build: (t) =>
      tsv([
        ["리뷰어", "채널", "발송일", "리뷰 마감", "리뷰 링크", "원고료", "지급일", "지급완료"],
        ["리뷰어 하늘", "블로그", fmt.dotShort(t, -14), fmt.dotShort(t, -4), "https://blog.naver.com/demo_d1/106", "50,000", fmt.dotShort(t, -1), "X"],
        ["리뷰어 바다", "인스타", fmt.dotShort(t, -14), fmt.dotShort(t, -4), "", "50,000", fmt.dotShort(t, 6), "X"],
        ["리뷰어 숲", "블로그", fmt.dotShort(t, -14), fmt.dotShort(t, -4), "블로그 올림", "50,000", fmt.dotShort(t, 6), "X"],
        ["리뷰어 하늘", "블로그", fmt.dotShort(t, -14), fmt.dotShort(t, -4), "https://blog.naver.com/demo_d1/106", "50,000", fmt.dotShort(t, -1), "X"],
        ["리뷰어 별", "유튜브", fmt.dotShort(t, -10), fmt.dotShort(t, 2), "", "100,000", fmt.dotShort(t, 12), ""],
        ["리뷰어 구름", "블로그", fmt.dotShort(t, -20), fmt.dotShort(t, -10), "https://blog.naver.com/demo_d5/107", "50,000", fmt.dotShort(t, -5), "O"],
      ]),
    expected: {
      overdueUnpublished: 1,
      dueSoonUnpublished: 1,
      paymentOverdue: 2,
      overdueOutstanding: 100_000,
      pendingOutstanding: 300_000,
      cancelledRows: 0,
      needsReview: 1,
      duplicates: 1,
    },
  },
];
