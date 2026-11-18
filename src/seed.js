// 기본 콘텐츠. 관리자 화면에서 수정하면 D1의 content 테이블 값이 이 기본값을 대신합니다.

export const EVENT_TYPES = [
  '팝업스토어', '전시', '브랜드 행사·런칭', '기업 행사·세미나', '네트워킹·파티',
  '공연·쇼케이스', '마켓·플리마켓', '촬영(화보·영상)', '단기 임대', '기타',
];

export const OPTION_LIST = [
  '사전 답사', '케이터링', '음료·주류 운영', '음향·영상 장비', '테이블·의자',
  '주차', '설치·철수일 별도 필요', '세금계산서 발행',
];

export const BUDGETS = ['미정', '300만원 이하', '300~500만원', '500~1,000만원', '1,000~3,000만원', '3,000만원 이상'];

export const INQUIRY_STATUS = {
  new: '신규',
  consulting: '상담 중',
  quoted: '견적 발송',
  contracting: '계약 진행',
  confirmed: '예약 확정',
  done: '행사 완료',
  hold: '보류',
  cancelled: '취소',
};

export const BOOKING_STATUS = { hold: '가예약', confirmed: '확정', done: '완료', cancelled: '취소' };
export const QUOTE_STATUS = { draft: '작성 중', sent: '발송', accepted: '수락', declined: '거절', expired: '만료' };
export const LEAD_STATUS = { new: '새 요청', contacted: '연락함', converted: '문의로 전환', closed: '종료' };
export const PARTNER_STATUS = { new: '신규', reviewing: '검토 중', visit: '현장 확인', proposal: '운영 제안', contracted: '계약', declined: '보류·반려' };
export const HOST_STATUS = { invited: '초대함', active: '사용 중', paused: '일시 중지' };
export const SETTLE_STATUS = { draft: '작성 중', confirmed: '확정', paid: '지급 완료' };
export const PARTNER_MODELS = ['위탁 운영(매출 배분)', '임차 운영(마스터리스)', '공실 기간 단기 활용', '상담 후 결정'];

export const DEFAULTS = {
  settings: {
    brand: '메자닌 서울',
    brand_en: 'MEZZANINE SEOUL',
    description: '건물과 건물을 2층에서 이은 복합 대관 공간. 삼성·북가좌·한남에서 팝업, 전시, 브랜드 행사, 공연을 엽니다.',
    notice: '',
    channels: {
      kakao: 'http://pf.kakao.com/_BxiQsX',
      instagram: 'https://www.instagram.com/mezzanine.seoul',
      blog: 'https://blog.naver.com/mezzanineseoul',
      youtube: '',
    },
    contact: { phone: '', email: '', hours: '' },
    business: { company: '', ceo: '', regno: '', address: '' },
    notify: { webhook: '' },
    site_url: '',
  },

  venues: [
    {
      slug: 'samsung',
      name: '메자닌 삼성',
      name_en: 'Mezzanine Samsung',
      status: 'open',
      district: '강남구 삼성동',
      address: '서울 강남구 봉은사로68길 35-1',
      color: '#2447F0',
      headline: '중정을 둘러싼 세 동이 2층에서 이어집니다',
      summary:
        '약 200평, 독채 세 동과 마당 중정으로 이루어진 지점입니다. 각 동의 2층이 메자닌으로 연결되어 있어 한 동만 쓰는 소규모 행사부터 세 동을 모두 쓰는 300명 규모의 파티까지 열 수 있습니다. 유리 지붕 아래로 자연광이 들어 촬영과 브랜드 팝업에도 잘 맞습니다.',
      stats: [
        { label: '규모', value: '약 200평' },
        { label: '구성', value: 'A·B·C 3개 동' },
        { label: '층', value: '동별 B1 · 1F · 2F' },
        { label: '진행 사례', value: '스탠딩 300명' },
      ],
      linked: true,
      courtyard: true,
      buildings: [
        {
          name: 'A동',
          floors: [
            { f: '2F', area: null, desc: '탁 트인 메인 공간. 유리 지붕 존과 테라스로 이어집니다.' },
            { f: '1F', area: null, desc: '메인 공간과 여러 개의 테라스, 화장실.' },
            { f: 'B1', area: null, desc: '' },
          ],
        },
        {
          name: 'B동',
          floors: [
            { f: '2F', area: null, desc: '창가 오픈 공간. 유리 지붕 존이 테라스 끝과 맞닿아 있습니다.' },
            { f: '1F', area: null, desc: '도로와 마주한 오픈 홀. 측면 계단 출입구가 있어 배치를 자유롭게 바꿀 수 있습니다.' },
            { f: 'B1', area: null, desc: '' },
          ],
        },
        {
          name: 'C동',
          floors: [
            { f: '2F', area: null, desc: '룸 2개와 테라스, 화장실, 팬트리.' },
            { f: '1F', area: null, desc: '' },
            { f: 'B1', area: null, desc: '' },
          ],
        },
      ],
      features: [
        '유리 지붕으로 자연광이 드는 2층 공간',
        '세 동의 2층을 잇는 메자닌 동선',
        '마당 중정과 여러 개의 테라스',
        '동 단위 부분 대관, 세 동 전체 대관 모두 가능',
        '케이터링, 커피·생맥주·와인 등 행사 운영 협의 가능',
      ],
      uses: ['브랜드 팝업', '전시', '기업 행사', '네트워킹 파티', '애프터파티', '촬영'],
      zone_options: ['건물 전체', 'A동', 'B동', 'C동', '상담 후 결정'],
      access: [
        { label: '9호선 삼성중앙역', value: '도보 5분' },
        { label: '수인분당선·9호선 선정릉역', value: '도보 10분' },
        { label: '2호선·수인분당선 선릉역', value: '도보 10분' },
      ],
      parking: '',
      map: { naver: 'https://naver.me/FgESezMd', kakao: '' },
      brochure: 'https://drive.google.com/file/d/1s7jILRl_M00hQq49xfPsi22WchXNv5M1/view',
      brochure_label: '삼성 지점 베뉴 소개서 (26.4Q, 8쪽)',
      hero_image: '/assets/venue/samsung/a2f.jpg',
      map_image: '/assets/venue/samsung/map.jpg',
      guide: {
        summary: '중정을 가운데 두고 세 동이 이어진 공간입니다. 실내와 테라스, 2층을 잇는 동선이 있어 구역을 나눠 쓰거나 하나로 묶어 쓸 수 있습니다.',
        legend: [['#e4e4e4', '실내'], ['#f6d6c3', '테라스'], ['#cfe0f2', '출입문']],
        floors: [
          { id: 'a1f', bldg: 'A동', floor: '1F', sub: '메인 공간 · 테라스', highlights: ['메인 공간', '테라스 여러 곳', '화장실'], details: [['a1f-1', '외부 진입로'], ['a1f-2', '테라스 쪽 실내']] },
          { id: 'a2f', bldg: 'A동', floor: '2F', sub: '메인 공간 · 테라스', highlights: ['탁 트인 메인 공간', '유리 지붕 존', '테라스 연결'], details: [['a2f-1', '테라스 데크'], ['a2f-2', '유리 지붕 존']] },
          { id: 'b1f', bldg: 'B동', floor: '1F', sub: '오픈 홀 · 도로 쪽 전면', highlights: ['오픈 홀', '도로 쪽 전면', '측면 출입', '자유로운 배치'], details: [['b1f-1', '측면 계단 출입구'], ['b1f-2', '건물 전면']] },
          { id: 'b2f', bldg: 'B동', floor: '2F', sub: '오픈 공간 · 유리 지붕 존', highlights: ['오픈 공간', '유리 지붕 존', '테라스 끝'], details: [['b2f-1', '창가 쪽 오픈 공간'], ['b2f-2', '유리 지붕 존과 테라스 끝']] },
          { id: 'c2f', bldg: 'C동', floor: '2F', sub: '메인 공간 · 테라스', highlights: ['룸 2개', '테라스', '화장실', '팬트리'], details: [['c2f-1', '룸·라운지'], ['c2f-2', '테라스']] },
        ],
      },
      video: 'mcoh193A1sA',
      instagram: '',
    },
    {
      slug: 'bukgajwa',
      name: '메자닌 북가좌',
      name_en: 'Mezzanine Bukgajwa',
      status: 'open',
      district: '서대문구 북가좌동',
      address: '서울 서대문구 응암로 118',
      color: '#0E8A6A',
      headline: '공연장부터 루프탑까지, 세 동 340평',
      summary:
        '대지 283평에 건물 세 동이 중정을 두고 모여 있습니다. A동 지하에는 LED 백스크린을 갖춘 공연장이 있고, 1층은 대로변을 향해 열려 있으며, 2층은 사방이 유리로 둘러싸여 있습니다. 팝업과 전시, 마켓, 공연, 카페 운영까지 건물 전체를 하나의 행사장으로 쓸 수 있습니다.',
      stats: [
        { label: '대지', value: '283평' },
        { label: '건물', value: '3개 동 약 340평' },
        { label: '루프탑', value: '85평' },
        { label: '주차', value: '최대 7대' },
      ],
      linked: true,
      courtyard: true,
      buildings: [
        {
          name: 'A동',
          total: 209,
          floors: [
            { f: 'RT', area: 85, desc: '루프탑. 이용 범위는 행사 성격에 따라 협의합니다.' },
            { f: '2F', area: 85, desc: '사방이 유리로 둘러싸인 메인 공간.' },
            { f: '1F', area: 85, desc: '대로변을 향한 메인 공간. 복층 구조이고 출입 동선이 여러 방향으로 나 있습니다.' },
            { f: 'B1', area: 40, desc: '공연장. LED 백스크린과 화장실이 있습니다.' },
          ],
        },
        {
          name: 'B동',
          total: 46,
          floors: [
            { f: '2F', area: 23, desc: '' },
            { f: '1F', area: 23, desc: '' },
          ],
        },
        {
          name: 'C동',
          total: 85,
          floors: [
            { f: '2F', area: 34, desc: '' },
            { f: '1F', area: 34, desc: '' },
            { f: 'B1', area: 18, desc: '' },
          ],
        },
      ],
      features: [
        'LED 백스크린을 갖춘 지하 공연장',
        '대로변을 향해 열린 1층 전면',
        '전면 유리로 둘러싸인 2층',
        '세 동을 잇는 2층 동선과 중정',
        '팝업, 전시, 대관, 카페 운영 모두 가능',
      ],
      uses: ['팝업스토어', '전시', '마켓', '공연', '카페 운영', '브랜드 행사', '촬영'],
      zone_options: ['건물 전체', 'A동', 'B동', 'C동', 'A동 지하 공연장', '루프탑', '상담 후 결정'],
      access: [{ label: '6호선 증산역', value: '도보 약 10분' }],
      parking: '최대 7대',
      map: { naver: 'https://naver.me/FMcN6M5m', kakao: '' },
      brochure: 'https://drive.google.com/file/d/1ybjDrcr3eKSA06TZHOu2EQWPJMvTxFsd/view',
      brochure_label: '북가좌 지점 베뉴 소개서 (26.4Q, 8쪽)',
      hero_image: '/assets/venue/bukgajwa/front.jpg',
      map_image: '/assets/venue/bukgajwa/map.jpg',
      guide: {
        summary: '중정을 두고 세 동이 모여 있고, 실내와 테라스, 2층을 잇는 동선으로 연결됩니다. 지하 공연장부터 사방이 유리인 2층까지 층마다 성격이 다릅니다.',
        legend: [['#cfe0f2', '출입문'], ['#f6d8c6', '메인 공간'], ['#ededed', '보조 공간']],
        floors: [
          { id: 'a0f', bldg: 'A동', floor: 'B1', sub: '지하 공연장', highlights: ['공연장', 'LED 백스크린', '화장실'], details: [['a0f-1', '공연장 내부'], ['a0f-2', '공연 중인 모습']] },
          { id: 'a1f', bldg: 'A동', floor: '1F', sub: '메인 공간 · 대로변 전면', highlights: ['메인 공간', '복층 구조', '여러 방향의 출입 동선'], details: [['a1f-1', '메인 공간'], ['a1f-2', '복층(메자닌) 공간']] },
          { id: 'a2f', bldg: 'A동', floor: '2F', sub: '메인 공간', highlights: ['메인 공간', '사방이 유리'], details: [['a2f-1', '메인 공간'], ['a2f-2', '복층(메자닌) 공간']] },
        ],
      },
      video: 'R3XViXgbSlc',
      drive_videos: ['1UwwadvzQJ80keF5d1Wc2uwLfff-xhctI', '134KbpICbDT8foWHz_h1ITVm_t_BKvXCO'],
      instagram: '',
    },
    {
      slug: 'hannam',
      name: '메자닌 한남',
      name_en: 'Mezzanine Hannam',
      status: 'open',
      district: '용산구 한남동',
      address: '서울 용산구 한남대로 158 지층',
      color: '#B4690E',
      headline: '한남대로변, 깊이 30m의 단독 공간',
      summary:
        '북한남동 초입 대로변 건물의 지층 100평 전체를 씁니다. 안쪽으로 30m 깊게 뻗은 인더스트리얼 무드의 공간이고, 조명 라인마다 밝기를 따로 조절할 수 있어 별도 인테리어 없이 조명만으로 분위기를 바꿀 수 있습니다. 건물의 다른 입주자와 동선이 겹치지 않습니다.',
      stats: [
        { label: '규모', value: '100평' },
        { label: '구성', value: '지층 단독' },
        { label: '깊이', value: '30m' },
        { label: '층고', value: '2.8m' },
      ],
      linked: false,
      courtyard: false,
      buildings: [
        {
          name: '한남대로 158',
          wide: true,
          floors: [
            { f: '4F', ghost: true },
            { f: '3F', ghost: true },
            { f: '2F', ghost: true },
            { f: '1F', ghost: true },
            { f: 'B1', area: 100, desc: '지층 전체 100평. ㄱ자 구조에 기둥이 적고, 안쪽으로 30m 깊이입니다.', dim: '깊이 30m' },
          ],
        },
      ],
      features: [
        '조명 라인별 밝기 조절(조광기)로 조명만으로 연출 가능',
        '2024년 전체 리모델링, 천장형 시스템 냉난방기 4대',
        'ㄱ자 구조, 기둥이 적은 100평',
        '출입구 3곳(대로변 2, 건물 뒤 주차장 쪽 계단 1)',
        '화장실 2곳, 다른 입주자와 겹치지 않는 단독 동선',
      ],
      uses: ['팝업스토어', '전시', '브랜드 행사', '단기 임대'],
      zone_options: ['지층 전체(100평)'],
      access: [
        { label: '6호선 한강진역', value: '2번 출구' },
        { label: '주변', value: '블루스퀘어 맞은편, 북한남동 삼거리' },
      ],
      parking: '1대',
      map: { naver: '', kakao: '' },
      brochure: '',
      video: 'JvxDkKSciMw',
      instagram: 'https://www.instagram.com/mezzanine.hannam/',
    },
    {
      slug: 'eungam',
      name: '메자닌 응암',
      name_en: 'Mezzanine Eungam',
      status: 'coming',
      district: '오픈 준비 중',
      address: '',
      color: '#7446D8',
      headline: '네 번째 메자닌이 곧 문을 엽니다',
      summary:
        '메자닌 응암은 지금 오픈을 준비하고 있습니다. 공간 구성과 일정이 정해지는 대로 이 페이지에 올리겠습니다. 오픈 알림을 신청해 두시면 대관이 열릴 때 가장 먼저 연락드립니다.',
      stats: [],
      linked: false,
      courtyard: false,
      buildings: [],
      features: [],
      uses: [],
      access: [],
      parking: '',
      map: { naver: '', kakao: '' },
      brochure: '',
      video: '',
      instagram: '',
    },
  ],

  cases: [
    {
      id: 'global-standing-party',
      title: '글로벌 스탠딩 파티',
      venue: 'samsung',
      type: '네트워킹·파티',
      date: '2026',
      scope: 'A·B·C동 전체 대관',
      summary:
        '국내외 참가자 300명이 모인 네트워킹 파티입니다. 세 동과 중정을 모두 열고, 2층 메자닌 동선으로 사람들이 건물 사이를 자유롭게 오가도록 운영했습니다.',
      facts: ['참가 300명', '3개 동 + 중정', '스탠딩 진행'],
      video: 'mcoh193A1sA',
      link: '',
    },
    {
      id: 'bbangryeok-market',
      title: '빵력장터',
      venue: 'bukgajwa',
      type: '마켓·플리마켓',
      date: '2026.05.29 – 05.31',
      scope: 'A동',
      summary:
        '빵모닝이 연 디저트·베이커리 마켓입니다. 22개 브랜드가 사흘 동안 참여했고, 브랜드별 QR 웨이팅으로 대기 줄을 건물 안팎에 나눠 운영했습니다.',
      facts: ['참여 브랜드 22곳', '3일간 운영', '오전 11시 – 오후 6시'],
      video: '',
      drive_videos: ['1UwwadvzQJ80keF5d1Wc2uwLfff-xhctI'],
      link: 'https://nutrigram.notion.site/3657ed94f698805a9453d6de6706551d',
    },
    {
      id: 'live-stage',
      title: '밴드 라이브 공연',
      venue: 'bukgajwa',
      type: '공연·쇼케이스',
      date: '',
      scope: 'A동 공연장',
      summary:
        'LED 백스크린과 무대 조명을 갖춘 A동 공연장에서 밴드 공연과 쇼케이스가 여러 차례 열렸습니다. 객석을 무대 가까이 배치할 수 있고, 리셉션이나 굿즈 판매는 다른 층과 동에서 나눠 운영할 수 있습니다.',
      facts: ['LED 백스크린', '무대 조명', '객석 배치 공연'],
      video: '',
      drive_videos: ['1knH721QM0_ducH8EB0heXEydkN_ETTG6', '134KbpICbDT8foWHz_h1ITVm_t_BKvXCO', '1VMA6ShRlSvP35haz_jP44n9qfapI6vzY'],
      link: '',
    },
    {
      id: 'seoul-vibes-union-days',
      title: 'Seoul Vibes : Union Days',
      venue: 'bukgajwa',
      type: '팝업스토어',
      date: '2025.12.05 – 12.07',
      scope: '건물 전체',
      summary:
        '캠핑 브랜드들이 한자리에 모인 연합 팝업입니다. 건물 곳곳을 브랜드별 부스로 나눠 쓰고, 신제품 공개와 할인 판매를 함께 진행했습니다.',
      facts: ['캠핑 브랜드 연합 팝업', '3일간 운영'],
      video: 'R3XViXgbSlc',
      link: '',
    },
    {
      id: 'children-day',
      title: 'KIDS PLAY FESTIVAL · 어린이를 어린이답게',
      venue: 'bukgajwa',
      type: '브랜드 행사·런칭',
      date: '2026.05.05',
      scope: 'A·B·C동 전관과 중정',
      summary:
        '패브릭토리가 어린이날에 연 키즈 페스티벌입니다. A동 1층은 자유체험존, 2층은 클래스존, B동은 푸드와 마켓, 중정은 브랜드 마켓, C동은 브랜드 팝업으로 나눠 건물 전체를 하나의 축제장으로 썼습니다.',
      facts: ['오전 11시 – 오후 5시', '키즈 클래스·북 콘서트 12개 이상', '동별로 프로그램 구분'],
      video: '',
      link: '',
    },
  ],

  faqs: [
    {
      q: '대관 비용은 어떻게 정해지나요?',
      a: '지점, 사용하는 동과 층, 날짜와 시간, 행사 성격에 따라 달라져서 건별로 견적을 드립니다. 대관 문의를 남기시면 내용을 확인한 뒤 견적서를 보내드립니다.',
    },
    {
      q: '건물 일부만 빌릴 수도 있나요?',
      a: '네. 한 동이나 한 층만 쓰는 대관부터 건물 전체 대관까지 가능합니다. 문의하실 때 필요한 공간을 골라 주시면 그에 맞춰 안내합니다.',
    },
    {
      q: '미리 공간을 둘러볼 수 있나요?',
      a: '사전 답사는 예약제로 진행합니다. 문의 양식에서 "사전 답사"를 선택하고 가능한 날짜를 적어 주세요.',
    },
    {
      q: '설치와 철수에 필요한 날도 대관 기간에 넣어야 하나요?',
      a: '설치·철수 시간도 공간을 쓰는 시간이라 일정에 포함해 견적을 냅니다. 행사일과 별도로 설치·철수일이 필요하면 문의에 함께 적어 주세요.',
    },
    {
      q: '케이터링이나 주류를 들여와도 되나요?',
      a: '행사에 따라 케이터링과 음료·주류 운영을 함께 협의합니다. 필요한 내용을 문의에 적어 주시면 가능한 범위를 안내합니다.',
    },
    {
      q: '주차는 몇 대까지 되나요?',
      a: '북가좌는 최대 7대, 한남은 1대입니다. 삼성 지점과 행사 차량 진입은 문의 시 안내합니다.',
    },
    {
      q: '예약은 언제 확정되나요?',
      a: '견적을 확인하고 계약을 마치면 일정이 확정됩니다. 그전까지는 같은 날짜에 다른 문의가 들어올 수 있으니, 일정이 정해졌다면 빨리 알려 주세요.',
    },
    {
      q: '메자닌 응암은 언제 열리나요?',
      a: '지금 오픈을 준비하고 있습니다. 응암 지점 페이지에서 오픈 알림을 신청하시면 대관이 열릴 때 먼저 연락드립니다.',
    },
  ],

  guide: {
    notes: [
      '대관 시간에는 설치와 철수 시간이 포함됩니다.',
      '행사 후에는 공간을 처음 상태로 돌려놓아야 합니다. 시설이나 집기가 파손되면 복구 비용이 청구될 수 있습니다.',
      '소음, 화기 사용, 대형 구조물 설치는 사전에 협의한 범위 안에서만 가능합니다.',
      '주변이 주거·업무 지역이므로 야간 행사는 종료 시간을 미리 협의합니다.',
    ],
  },

  // 견적서 작성 시 불러다 쓰는 요금 항목. 관리자 화면에서 관리합니다.
  rates: [],
  partner: { open: true },
};

// 처음 배포했을 때 넣어 두는 기본 사진. 구글드라이브 공유 폴더의 파일을 서버가 처음 열 때 한 번 받아 D1에 저장합니다.
// 관리자에서 지우거나 순서를 바꾸면 그대로 유지되고, 다시 채워지지 않습니다.
export const SEED_MEDIA_VERSION = 3;
const D = {
  B001: '10Mu3JHmTj-rEE2EaaEU4O4pIklaoLGct', B002: '1cnM1GSIXcFp4xuO6B9kgzhobuFMJwDrM', B003: '1GQp0KRKOBPyCu2Adbvj_BPgrffXu4zoi',
  B004: '1a5h2F2qo7_MTJncoCxeYDNAMp0SZ9pzT', B005: '18Dz-iaGH7zSCV6XRRECDFeyHdjJi30Y-', B006: '1tdwR2k-klF4qeYc91c6uEJKV8NOVPQxz',
  G008: '1uqyq5xTrGuJjCSwZkNxt2_Xo5XIwKYJs', G010: '1iSd38622tK92DWKLOix3clEcRgjmnOkN', G011: '1fuKRrgZF8sj96D7zU6gLlMxD3b4jAG0P',
  G013: '1QWHF0P8FPa405X7E9h-4QiQaJxdRlmdD', G015: '1SLawgP8tRXGKPODmeZYJBn6oANNE9ZzG', G020: '1dtPs9m7wB5XjYFAw1P2vCVXQSrsTqyXu',
  G025: '1ShF0muuYiCrhOGdgHYXjsMxjpC3vm5LK', P016: '1Gh_0ZBmGp2F2pckjryH_uY9ks1K3mmmh', P061: '17WtTCRY8-sKIDjTnxJEvkV3TePFrdSYX',
  P087: '1sas-Fa3QynR5A5aFJNiuXy1umhXZgC37', P112: '1xuaKpKdkASs8TErGxKciybzdvMXbEzez', K006: '1gb8aK56aFCBfsDi_ZKQzkC77djf9yTbh',
  K015: '1RcNgtenbIleKCkeNYeYCPElgoOISD566', K031: '1_wsMFbWRnN862lc-UmanqWFtwg0jnGE4',
};
export const SEED_MEDIA = {
  'venue:bukgajwa': [
    [D.B002, 'A동 정면, 응암로 쪽 유리 전면'],
    [D.G015, 'A동 공연장, LED 백스크린과 무대 조명'],
    [D.B005, 'A동 내부, 마켓 행사 중'],
    [D.G008, '공연장 객석'],
    [D.B001, '빵력장터 당일 A동 앞'],
    [D.B006, '마켓 부스 배치'],
    [D.G010, '밴드 공연'],
    [D.K015, '유리로 둘러싸인 내부'],
    [D.P061, '공연 무대'],
    [D.B004, '행사 당일 대기 줄'],
  ],
  'case:bbangryeok-market': [
    [D.B001, 'A동 앞 대기 줄'],
    [D.B005, 'A동 내부 마켓'],
    [D.B006, '브랜드 부스'],
    [D.B002, 'A동 정면'],
    [D.B003, '응암로를 따라 선 대기 줄'],
    [D.B004, '대기 줄'],
  ],
  'case:live-stage': [
    [D.G010, ''],
    [D.G015, ''],
    [D.G020, ''],
    [D.G011, ''],
    [D.G013, ''],
    [D.G025, ''],
    [D.P016, ''],
    [D.P061, ''],
    [D.P087, ''],
    [D.P112, ''],
    [D.G008, '객석에서 본 무대'],
  ],
  'case:children-day': [
    [D.K006, '행사 포스터 · 패브릭토리'],
    [D.K031, '행사 안내 포스터 · 패브릭토리'],
  ],
};

// 2차 기본 이미지 (2026-11-15): 화이트 갤러리 브랜드 이미지, 한남 실사진, 활용 연출 이미지
// kind: photo = 실제 사진, brand = 실제 공간을 바탕으로 보정한 브랜드 이미지, staged = 활용 연출 이미지(실제 행사 아님)
// pos: first = 해당 목록 맨 앞에 넣기
const WG = {
  W04: '1sSWN32ab36GRnoBQxJ0PMT2fMwIDZzi0', W05: '1KBJD0zHcCQepA36S4JAZMX35NJVELwgC', W06: '1FOEwZ0Hs4gWTGZBPFfj_CCuRKKgzdSGp',
  W07: '1nwgiOz3TPFOk5ZNfucDQFl6yfAO4r232', W08: '1Un91y_6-EAwuAPUSEofvGNFFPe3CB8tH', W09: '1RgHFcHgk8t1lpS1WG1BBnOYBwP-yduQB',
  W10: '17XF0Hw2kDLRxWoTDmWCrj1uwzPNh0eql', W18: '1ukcyxnORSHQ3YOVzrlG0u3CiF1DU1Xfz', W19: '1s6sVznC3K0S7OeUyHFjU52kevEsKkx9I',
  W20: '14dIsh2thPG5rI-4h1A9mgMjAEIU71_R8',
};
const HN = {
  h24: '1LsxgxzXoCbmqDUGSwQhEjoQl3srEmqZM', h48: '1khrlX40PjRZIzhli-wm1XKrT5G1CI2MF', h35: '1kJzpFIR7Mb1C533TeM_RpRQSF_QRY8XU',
  h02: '18J8gD2iZEAQrmZIYCMKCrAlPxVgzQOJ2', h31: '1cdR5LbZN0rz797jyH7S4KuRJDbcOvvR8', h45: '1BV3zDiU0HB6MWbftqyGu0E1qGGF6uUyf',
  h40: '14AlMBxCId3Y0gkNPrfLVd6r7XcBtRr_A', h37: '1TdcJppR4ycJxX_UN5jqoLc-2rzQ2Uqn6', h15: '1hc8CK4EzWW_jNxXCVC8oUe60phBqNQgG',
};
export const SEED_MEDIA_V2 = [
  ['site:hero', WG.W05, '메자닌 삼성, 유리 지붕 아래 2층', 'brand'],
  ['site:hero', WG.W06, '메자닌 북가좌 아트리움', 'brand'],
  ['site:og', WG.W04, '', 'brand'],
  ['site:use', WG.W18, '전시', 'staged'],
  ['site:use', WG.W19, '브랜드 팝업', 'staged'],
  ['site:use', WG.W20, '소규모 모임', 'staged'],
  ['venue:samsung', WG.W05, '유리 지붕 아래 2층 공간', 'brand'],
  ['venue:samsung', WG.W07, '자연광이 드는 유리 지붕 구간', 'brand'],
  ['venue:samsung', WG.W08, '창가 공간', 'brand'],
  ['venue:bukgajwa', WG.W06, '아트리움', 'brand', 'first'],
  ['venue:bukgajwa', WG.W10, '저녁의 A동 외관', 'brand', 'first'],
  ['venue:bukgajwa', WG.W09, '중정과 동을 잇는 계단', 'brand', 'first'],
  ['venue:hannam', HN.h24, '지층 전체', 'photo'],
  ['venue:hannam', HN.h48, '안쪽으로 이어지는 깊이', 'photo'],
  ['venue:hannam', HN.h35, '조명을 켠 모습', 'photo'],
  ['venue:hannam', HN.h02, '기둥이 적은 ㄱ자 구조', 'photo'],
  ['venue:hannam', HN.h31, '긴 벽면', 'photo'],
  ['venue:hannam', HN.h45, '흰 벽 구간', 'photo'],
  ['venue:hannam', HN.h40, '안쪽 끝까지 이어진 동선', 'photo'],
  ['venue:hannam', HN.h37, '건물 외관', 'photo'],
  ['venue:hannam', HN.h15, '한남대로 쪽 전경', 'photo'],
];

// v3: 지점 소개서에 실린 실제 공간 사진 (public/assets/venue/...) — 지점 사진 맨 앞에 넣습니다
// [사진 자리, 파일 경로, 설명, 종류]
export const SEED_MEDIA_V3 = [
  ['venue:samsung', '/assets/venue/samsung/exterior.jpg', '외관. 왼쪽부터 A동, C동, B동'],
  ['venue:samsung', '/assets/venue/samsung/a2f.jpg', 'A동 2층, 유리 지붕 존'],
  ['venue:samsung', '/assets/venue/samsung/b1f.jpg', 'B동 1층 오픈 홀'],
  ['venue:samsung', '/assets/venue/samsung/a1f.jpg', 'A동 1층 메인 공간'],
  ['venue:samsung', '/assets/venue/samsung/b2f.jpg', 'B동 2층 오픈 공간'],
  ['venue:samsung', '/assets/venue/samsung/c2f.jpg', 'C동 2층 메인 공간'],
  ['venue:samsung', '/assets/venue/samsung/dusk.jpg', '해 질 무렵의 외관'],
  ['venue:bukgajwa', '/assets/venue/bukgajwa/front.jpg', '대로변에서 본 A동'],
  ['venue:bukgajwa', '/assets/venue/bukgajwa/a2f.jpg', 'A동 2층, 사방이 유리인 메인 공간'],
  ['venue:bukgajwa', '/assets/venue/bukgajwa/side.jpg', 'A동 측면'],
  ['venue:bukgajwa', '/assets/venue/bukgajwa/courtyard.jpg', '중정'],
  ['venue:bukgajwa', '/assets/venue/bukgajwa/a1f.jpg', 'A동 1층 메인 공간'],
  ['venue:bukgajwa', '/assets/venue/bukgajwa/a0f.jpg', 'A동 지하 공연장'],
  ['venue:bukgajwa', '/assets/venue/bukgajwa/night.jpg', '저녁의 A동 전면'],
];
