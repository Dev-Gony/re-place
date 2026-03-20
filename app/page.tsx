import { createClient } from '@supabase/supabase-js';

// 1. Supabase (DB) 연결
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function Home() {
  // 2. DB에서 데이터 가져오기 (최신순으로 정렬해서 가져옵니다)
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('id', { ascending: false });

  return (
    <main className="p-10 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Re:Place 통합 검색</h1>
      
      {/* 3. 카드 그리드 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {data?.map((campaign) => (
          <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            
            {/* [추가됨] 썸네일 이미지 영역 */}
            {campaign.image_url ? (
              <div className="w-full h-48 bg-gray-100">
                <img 
                  src={campaign.image_url} 
                  alt={campaign.title} 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                이미지 없음
              </div>
            )}

            {/* 텍스트 정보 영역 */}
            <div className="p-5 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  {campaign.platform}
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {campaign.media_type}
                </span>
              </div>
              
              <h2 className="text-lg font-bold text-gray-800 mb-1 line-clamp-2">
                {campaign.title}
              </h2>
              
              {/* [추가됨] 제공 내역 (보상) 영역 */}
              <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-2">
                {campaign.reward || '제공 내역 없음'}
              </p>
              
              <a 
                href={campaign.link} 
                target="_blank" 
                rel="noreferrer"
                className="block w-full text-center bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors mt-auto"
              >
                캠페인 보러가기
              </a>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}