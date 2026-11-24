// @ts-check
/* =========================================================
 * config.js — 所有數值設定
 * 調整平衡只需要改這個檔案；其他檔案不寫死數值。
 * ========================================================= */

const CONFIG = {
  // ---------- 存檔 ----------
  save: {
    key: 'chestIdleRPG_save', // localStorage 的 key
    version: 17, // 1→2 道途；2→3 靈獸、每日任務、秘境購買；3→4 裝備外觀/套裝/強化/圖鑑、成就、簽到、商店、音量；4→5 福利、信箱、賽季戰令、累計儲值；5→6 開爐保底、靈獸蛋保底、Boss 戰意、秘境掃蕩紀錄；6→7 數值放大；7→8 功能開放表、開爐件數 13 檔；8→9 章節首殺獎勵（已通過的章節寄到信箱）；9→10 道途天賦（dao.talents）；10→11 每日任務池、每週任務、活躍度寶箱、月曆簽到；11→12 飛升（state.ascension）；12→13 爐階 21～30、神品、天劫里程碑（ascension.bestFinalTier 等）；13→14 第 2 次飛升送神品（已飛升 2 次以上寄到信箱補發）；14→15 靈獸覺醒（beasts.owned.*.awakened）；15→16 存檔保護（state.backup）；16→17 鎮妖塔每日塔俸（dungeons.tower.sweepDate）
    autoSaveIntervalMs: 10000, // 自動存檔間隔
    // v10 以前的三個固定每日任務（v10→v11 遷移時，「已完成但沒領」的照原本的獎勵自動發放）
    legacyDailyTasks: [
      { id: 'open', name: '開爐煉器', target: 30, reward: { eggs: 1, iron: 1 } },
      { id: 'kill', name: '斬妖除魔', target: 150, reward: { eggs: 1, iron: 1 } },
      { id: 'dungeon', name: '秘境歷練', target: 3, reward: { eggs: 1, stones: 2, iron: 1 } },
    ],
  },

  // ---------- 版本（路線圖 C4）：sw.js 的 VERSION 要一樣；發布新版時兩個一起改，玩家才會看到「有新版本」 ----------
  app: { version: '1.0.1' },

  // ---------- 存檔保護（路線圖 C1，PLAN.md 2.26；backup.js） ----------
  //   自動備份：最多 slots 份（最舊的先刪），每 intervalMinutes 分鐘在線一份、每天第一次上線一份；存在 localStorage 的 autoKey
  //   主存檔讀不出來時：原始內容另存到 corruptKey，從最新的自動備份還原
  //   提醒匯出：已飛升 remindAfterAscensions 次以上、距離上次匯出（沒匯出過就從第一次飛升算）remindDays 天以上，每天最多一次
  //   2026-11-19 實測：飛升 14～15 次、玩 30 天的存檔約 10.6K 字元；Chromium 的 localStorage 上限約 5.2M 字元
  backup: {
    slots: 5,
    intervalMinutes: 30,
    remindDays: 7,
    remindAfterAscensions: 1,
    autoKey: 'chestIdleRPG_save_auto_backups',
    corruptKey: 'chestIdleRPG_save_corrupt_backup',
    fileName: 'lianqi-save-{date}.json', // 下載的存檔檔名（用英數字：部分瀏覽器會把中文檔名換成 download）
  },

  // ---------- 數值放大倍率 ----------
  // 這個檔案裡的貨幣與屬性數值都是「基準單位」。載入時由 scale.js 依下面的倍率整體放大，
  // 遊戲中看到的是放大後的數字（例如擊殺靈石 killGoldBase: 5 → 遊戲中 5000）。
  // 獎勵與花費一起放大，所以各種兌換比例、進度速度都不變。套用到哪些欄位見 scale.js 的 SCALE_FIELDS。
  //   gold 靈石、keys 爐火符、stones 仙玉、iron 玄鐵、essence 靈獸精魄
  //   stats 角色、怪物、法寶的攻擊／氣血／護體（戰力跟著放大；會心率、身法等比例屬性不放大）
  //   靈獸蛋是道具（一顆孵一隻），不放大
  scale: { gold: 1000, keys: 10, stones: 10, iron: 10, essence: 10, stats: 10000000 },

  // ---------- 新手初始資源 ----------
  newPlayer: {
    gold: 0,
    keys: 10,
    upgradeStones: 0,
  },

  // ---------- 角色基礎屬性 ----------
  baseStats: {
    atk: 10,
    hp: 100,
    def: 5,
    spd: 1.0, // 每秒攻擊次數
    critRate: 0.05,
    critDmg: 1.5,
    lifesteal: 0,
    dodge: 0,
  },

  // 屬性上限（沒列出的屬性沒有上限）
  statCaps: {
    critRate: 0.8,
    lifesteal: 0.3,
    dodge: 0.4,
    cdr: 0.4, // 技能冷卻縮減上限
  },

  // ---------- 屬性顯示定義 ----------
  // pct: true 代表以百分比顯示；decimals 為顯示的小數位數
  statDefs: {
    atk: { name: '攻擊', pct: false, decimals: 0 },
    hp: { name: '氣血', pct: false, decimals: 0 },
    def: { name: '護體', pct: false, decimals: 0 },
    spd: { name: '身法', pct: false, decimals: 2 },
    critRate: { name: '會心率', pct: true, decimals: 1 },
    critDmg: { name: '會心傷害', pct: true, decimals: 0 },
    lifesteal: { name: '吸血', pct: true, decimals: 1 },
    dodge: { name: '閃避', pct: true, decimals: 1 },
    atkPct: { name: '攻擊%', pct: true, decimals: 1 },
    hpPct: { name: '氣血%', pct: true, decimals: 1 },
    defPct: { name: '護體%', pct: true, decimals: 1 },
    goldPct: { name: '靈石掉落', pct: true, decimals: 1 },
    cdr: { name: '技能冷卻', pct: true, decimals: 1 },
  },

  // ---------- 戰力公式係數 ----------
  // 戰力 = atk×atk + hp×hp + def×def
  //      + atk × spd × (critRate × (critDmg - 1)) × crit
  //      + atk × (spd - 基礎攻速) × spdBonus     ← 讓攻速裝備也反映在戰力上（設 0 即關閉）
  //      + atk × spd × lifesteal × lifesteal
  //      + hp × dodge × dodge
  power: {
    atk: 2,
    hp: 0.2,
    def: 1.5,
    crit: 3,
    spdBonus: 2,
    lifesteal: 8,
    dodge: 1,
    // 道途技能折算戰力：
    //   傷害技能 = atk × (倍率 / 冷卻秒數) × skillDamage（等於每秒多出的攻擊次數）
    //   減傷技能 = hp × hp係數 × 有效血量增幅 × skillShield
    skillDamage: 2,
    skillShield: 1,
    // 仙品「回血」特效折算戰力：氣血 × hp係數 × 機率 × 回血比例 × 身法 × healEffect
    healEffect: 10,
  },

  // ---------- 裝備部位 ----------
  // main：部位基礎值（主屬性），實際數值 = 基礎值 × (1 + 裝備等級 × levelScale) × 品質倍率 × 隨機浮動
  slotOrder: /** @type {Slot[]} */ (['weapon', 'helmet', 'armor', 'gloves', 'boots', 'accessory']),
  // icon：圖示名稱（定義在 icons.js）
  slots: {
    weapon: { name: '飛劍', icon: 'sword', main: { atk: 8 } },
    helmet: { name: '道冠', icon: 'crown', main: { hp: 60, def: 2 } },
    armor: { name: '道袍', icon: 'robe', main: { def: 5, hp: 30 } },
    gloves: { name: '護腕', icon: 'bracer', main: { atk: 5, critRate: 0.005 } },
    boots: { name: '雲履', icon: 'shoe', main: { spd: 0.03, dodge: 0.003 } },
    accessory: { name: '玉佩', icon: 'pendant', main: { critDmg: 0.08, atk: 3 } },
  },

  // ---------- 裝備數值 ----------
  equipment: {
    levelScale: 0.15, // 每級主屬性 +15%
    // 額外的指數成長：主屬性再 × levelGrowth^裝備等級（1 = 原公式）
    // 怪物是指數成長，裝備只有線性成長會在中後期完全追不上，所以加上這一項
    // 這個值非常敏感。第五輪調整（加入套裝、強化、靈獸等加成後）的模擬結果：
    //   1.0175 → 不到 1 小時破關；1.0 → 約 2 天；0.998 → 每天玩 4 小時約 2～4 天破關；0.996 → 約 4～7 天
    // 第五階段方案 C（爐火符收入隨境界成長 0.03）搭配 0.994：每天 4 小時約 2.5 天（使用者已確認）
    levelGrowth: 0.994,
    // 換裝比較時，不計入「比新法寶舊的境界」的套裝效果（避免舊套裝讓某個部位一直留著低品階法寶）
    ignoreOutdatedSets: true,
    randomMin: 0.9, // 主屬性隨機浮動下限
    randomMax: 1.1, // 主屬性隨機浮動上限
    levelDivisor: 2, // 裝備等級 = ceil(最高通關總關卡數 / levelDivisor)，最低 1
    minLevel: 1,
    subRarityBonus: 0.1, // 副屬性 × (1 + 品質序號 × subRarityBonus)
  },

  // ---------- 品質 ----------
  // 陣列索引 = 品質序號（凡品 0 ～ 仙品 5 ～ 神品 6）
  //   神品（B2，PLAN.md 2.24）：只有 21 階以上的爐子開得出；salvageIron：分解時另外給的玄鐵（基準單位）
  rarities: [
    { key: 'common', name: '凡品', color: '#6f6a62', statMult: 1.0, subCount: 0, salvageMult: 1 },
    { key: 'uncommon', name: '靈品', color: '#2f7a52', statMult: 1.3, subCount: 1, salvageMult: 2 },
    { key: 'rare', name: '玄品', color: '#2c5d8f', statMult: 1.7, subCount: 1, salvageMult: 4 },
    { key: 'epic', name: '地品', color: '#6b3f95', statMult: 2.3, subCount: 2, salvageMult: 10 },
    { key: 'legendary', name: '天品', color: '#b5791c', statMult: 3.2, subCount: 3, salvageMult: 30 },
    { key: 'mythic', name: '仙品', color: '#b3261e', statMult: 4.5, subCount: 4, salvageMult: 100 },
    { key: 'divine', name: '神品', color: '#0b8a8f', statMult: 6.3, subCount: 5, salvageMult: 300, salvageIron: 0.1 },
  ],
  mythicRarity: 5, // 仙品的品質序號（仙品專屬外觀與特效）
  divineRarity: 6, // 神品的品質序號（神品專屬外觀、鴻蒙套）

  // ---------- 副屬性（每條數值範圍） ----------
  subStats: {
    critRate: { min: 0.01, max: 0.04 },
    critDmg: { min: 0.05, max: 0.2 },
    spd: { min: 0.02, max: 0.08 },
    lifesteal: { min: 0.01, max: 0.03 },
    dodge: { min: 0.01, max: 0.03 },
    atkPct: { min: 0.02, max: 0.08 },
    hpPct: { min: 0.02, max: 0.08 },
    goldPct: { min: 0.03, max: 0.1 }, // 靈石加成
    cdr: { min: 0.02, max: 0.05 }, // 技能冷卻縮減（道途技能與靈獸攻擊）
  },

  // ---------- 分解 ----------
  // 分解金幣 = base × 裝備等級 × 品質分解倍率
  salvage: {
    base: 10,
  },

  // ---------- 寶箱 ----------
  chest: {
    minLevel: 1,
    maxLevel: 20, // 飛升前的上限；21～30 由 levelCaps 依功能開放提高（getChestMaxLevel）
    // 爐階上限提高（B2）：功能開放後上限改成 max（功能條件在 features：第 2 次飛升 25、第 5 次飛升 30）
    levelCaps: [
      { feature: 'chestBeyond', max: 25 },
      { feature: 'chestBeyond30', max: 30 },
    ],
    // 關鍵等級的機率（%），順序對應 rarities：凡品、靈品、玄品、地品、天品、仙品、神品
    // 中間等級以相鄰關鍵等級線性插值，並正規化為總和 100%
    rateKeyPoints: {
      1: [70, 25, 5, 0, 0, 0, 0],
      5: [45, 35, 15, 4.5, 0.5, 0, 0],
      10: [25, 35, 25, 12, 2.8, 0.2, 0],
      15: [10, 30, 32, 20, 7, 1, 0],
      20: [0, 20, 35, 28, 14, 3, 0],
      25: [0, 15, 33, 29, 15, 7.5, 0.5], // B2：使用者已確認（2026-11-18）
      30: [0, 5, 30, 33, 20, 10, 2],
    },
    // 升一階的靈石總額 = upgradeBaseCost × upgradeCostGrowth^(目前等級 - 1)
    // 分段強化：每一階要先強化 upgradeSegments.length 格，每格花「總額 × 該格比例」，填滿後才能升階
    upgradeSegments: [0.1, 0.13, 0.16, 0.18, 0.2, 0.23], // 合計 100%（使用者已確認）
    keysPerItem: 1, // 每開一件法寶消耗的爐火符
    upgradeBaseCost: 500,
    upgradeCostGrowth: 1.85, // 原 1.5；太便宜的話一小時內就升滿，後期沒有成長空間
    // 21 階以上（B2）：升一階的靈石 = 升到 20 階的費用 × upgradeCostGrowthBeyond^(目標等級 − 20)
    //   照 1.85 成長的話 30 階要 20 階的約 470 倍，後期靈石付不起；1.3 用模擬決定（PLAN.md 2.24）：
    //   飛升時靈石只留一成，每階的費用要在一次冷卻（2 天）內存得到；1.4 時 30 階只有 10/32 次升得到
    upgradeCostGrowthBeyond: 1.3,
    // 21 階以上每強化一格另外要的玄鐵（基準單位；key = 升到第幾階）。B2 使用者決定：讓聚寶的玄鐵收入有用處，但不能卡在玄鐵
    //   模擬（PLAN.md 2.24）：2→11 時一半的日子「靈石夠、玄鐵不夠」，減半後 0%
    upgradeIronBeyond: { 21: 1, 22: 1, 23: 2, 24: 2, 25: 3, 26: 3, 27: 4, 28: 4, 29: 5, 30: 5 },
    // 升到指定等級額外需要的仙玉（按「升階」時扣除）
    upgradeStoneReq: { 5: 3, 10: 8, 15: 15, 20: 25, 25: 40, 30: 60 },
    // 開爐保底（以件數計算；一次開 ×10 算 10 件）：
    //   連續 count 件都沒有開出 rarity 以上，第 count 件必定是該品階（高品階保底優先判定）。
    //   開出該品階以上時歸零。目前爐階完全開不出該品階時不累計（例如 1 階爐不會累計仙品保底）。
    //   參考：20 階爐平均約 2.4 件出地品以上、7 件出天品以上、33 件出仙品。
    pity: [
      { rarity: 3, count: 30 }, // 地品以上
      { rarity: 4, count: 120 }, // 天品以上
      { rarity: 5, count: 400 }, // 仙品
      { rarity: 6, count: 600 }, // 神品（21 階以上才累計）
    ],
  },

  // ---------- 功能開放表 ----------
  // 中段（靈獸～鎮妖塔）與爐階條件（強化、坊市、仙玉商店）在 2026-11-12 依模擬往前移（見 docs/PLAN.md 2.11、2.12）
  // 每個功能一行。所有功能、秘境、道途、靈獸欄位的開放條件都在這裡（開爐件數在下面的 chestTiers）。
  //   cond：開放條件，可組合（全部滿足才開放）；null = 一開始就開放
  //     stage 最高通關總關卡數、chest 煉器爐階數、day 第幾天（有上線的天數）、playMinutes 累計在線分鐘、ascensions 飛升次數
  //   kind：'feature' 新功能（播放「新功能開放」演出 → 已累積的進度 → 引導與「前往」）
  //         'upgrade' 升級提示（只跳簡短提示）
  //         'future'  預留給飛升後，目前不實作（不會開放）
  //   page：開放後「前往」的分頁；gift：開放時附贈（確保馬上能使用）
  //   backlog：鎖住期間在背後累積、開放時可一次領取的進度（daily／codex／achieve／pass）
  //   hint：開放時的提示文字
  features: [
    { id: 'battle', name: '修煉', kind: 'feature', cond: null, page: 'main', hint: '修士會自動與妖獸鬥法，逐層突破境界。' },
    { id: 'chestOpen', name: '開爐', kind: 'feature', cond: null, page: 'main', hint: '燒爐火符煉出法寶，增強戰力。' },
    { id: 'settings', name: '設定', kind: 'feature', cond: null, page: 'settings', hint: '音量、存檔匯出匯入。' },
    { id: 'chestUpgrade', name: '煉器爐升階', kind: 'feature', cond: { stage: 4 }, page: 'chest',
      hint: '用靈石強化煉器爐，填滿後升階，煉出高品階法寶的機率會提高。' },
    { id: 'dungeon', name: '歷練・靈石秘境', kind: 'feature', cond: { stage: 21 }, page: 'dungeon',
      hint: '每天可以挑戰秘境取得資源。靈石秘境：30 秒內轟擊靈石傀儡，傷害越高靈石越多。' },
    { id: 'dao', name: '道途', kind: 'feature', cond: { stage: 41 }, page: 'dao',
      hint: '從劍修、法修、體修中擇一而修，獲得屬性加成與專屬技能。第一次選擇免費。' },
    { id: 'beast', name: '靈獸', kind: 'feature', cond: { stage: 45 }, page: 'beast', gift: { eggs: 1 },
      hint: '孵化靈獸蛋，靈獸會在戰鬥中一起出手並提供加成。附贈一顆靈獸蛋。' },
    { id: 'enhance', name: '強化', kind: 'feature', cond: { chest: 8 }, page: 'enhance',
      hint: '用靈石強化部位，強化等級屬於部位，換裝也會保留，而且必定成功。' },
    { id: 'daily', name: '每日任務', kind: 'feature', cond: { playMinutes: 18 }, page: 'dungeon', backlog: 'daily',
      hint: '每天抽 4～5 個小任務，累積活躍度開寶箱（靈獸蛋、玄鐵、仙玉）；另有每週任務。每天 00:00 重置，沒領的獎勵會自動發放。' },
    { id: 'dungeonKey', name: '妖獸潮', kind: 'feature', cond: { stage: 52 }, page: 'dungeon',
      hint: '擊退一波波妖獸取得爐火符，第 5、10 波有機會掉落靈獸蛋。' },
    { id: 'codex', name: '圖鑑', kind: 'feature', cond: { stage: 55 }, page: 'codex', backlog: 'codex',
      hint: '煉出的每種法寶都會收錄，收集達標可以領獎。' },
    { id: 'market', name: '坊市', kind: 'feature', cond: { chest: 10 }, page: 'market',
      hint: '每天刷新 6 件商品，用靈石購買爐火符、玄鐵、靈獸蛋等。' },
    { id: 'achieve', name: '成就', kind: 'feature', cond: { stage: 62 }, page: 'achieve', backlog: 'achieve',
      hint: '達成各種里程碑可以領取仙玉等獎勵。' },
    { id: 'dungeonTower', name: '鎮妖塔', kind: 'feature', cond: { stage: 68 }, page: 'dungeon',
      hint: '一層一層往上闖，首次通過給仙玉，每 10 層有大獎。' },
    { id: 'shop', name: '仙玉商店與儲值', kind: 'feature', cond: { chest: 11 }, page: 'gemshop',
      hint: '用仙玉購買高級道具與外觀；儲值頁有超值方案（測試模式不會扣款）。' },
    { id: 'dungeonWorldBoss', name: '上古妖王', kind: 'feature', cond: { stage: 80 }, page: 'dungeon',
      hint: '60 秒內對不死的上古妖王全力出手，依傷害區間領獎。' },
    { id: 'signin', name: '簽到', kind: 'feature', cond: { day: 2 }, page: 'signin',
      hint: '每天簽到一次，30 格一輪，中斷不歸零；每 7 天一個大獎，第 28 格是限定外觀。' },
    { id: 'pass', name: '修仙戰令與信箱', kind: 'feature', cond: { stage: 90 }, page: 'recharge', backlog: 'pass',
      hint: '開爐、擊殺、每日任務、每週任務都會累積戰令經驗，升級領獎；賽季結束時未領的獎勵會寄到信箱。' },
    // 升級提示（不算新功能）
    { id: 'daoAscend', name: '道途二轉', kind: 'upgrade', cond: { stage: 61 }, page: 'dao', hint: '道途可以突破二轉了，加成與技能都會大幅強化。' },
    { id: 'beastSlot2', name: '靈獸第 2 欄位', kind: 'upgrade', cond: { stage: 62 }, page: 'beast', hint: '可以同時讓 2 隻靈獸上陣了。' },
    // 飛升（路線圖 B1，PLAN.md 2.22）：條件用「歷史最高關卡」
    { id: 'ascension', name: '飛升', kind: 'feature', cond: { stage: 90 }, page: 'ascend',
      hint: '本輪通過渡劫期十層就能飛升：關卡從頭再爬，靈石與爐火符保留一成，法寶、爐階、強化、道途、靈獸等全部保留，換得仙元點飛升天賦。' },
    // 飛升後開放（B2，PLAN.md 2.24）
    { id: 'chestBeyond', name: '爐階 21～25 與神品', kind: 'feature', cond: { ascensions: 2 }, page: 'chest',
      hint: '煉器爐可以升到 25 階，21 階起開得出仙品之上的新品階「神品」：每個部位一件專屬法寶，六件湊成鴻蒙套。21 階以上每強化一格另外需要玄鐵。' },
    { id: 'chestBeyond30', name: '爐階 26～30', kind: 'upgrade', cond: { ascensions: 5 }, page: 'chest', hint: '煉器爐可以升到 30 階，神品機率更高。' },
    // B3（PLAN.md 2.25）：開放時送一隻覺醒的精魄。已飛升 3 次以上的舊存檔，載入後照常播放演出、發贈禮
    { id: 'beastAwaken', name: '靈獸覺醒', kind: 'feature', cond: { ascensions: 3 }, page: 'beast', gift: { essence: 150 },
      hint: '5 星靈獸可以用精魄覺醒：被動與技能變強、每場戰鬥先手出手、技能換成覺醒技；每覺醒一隻，不上陣也有攻擊、氣血加成（覺醒共鳴）。附贈一隻覺醒所需的精魄。' },
  ],

  // ---------- 開爐件數檔位（功能開放表的一部分） ----------
  // cond：免費解鎖條件（每一檔都能靠進度解鎖）；monthCard：月卡生效中時的提早解鎖條件
  chestTiers: [
    { count: 1, cond: null },
    { count: 2, cond: { stage: 5 } },
    { count: 4, cond: { stage: 11 } },
    { count: 6, cond: { stage: 21 } },
    { count: 8, cond: { stage: 31 } },
    { count: 10, cond: { chest: 8 }, monthCard: { stage: 31 } },
    { count: 12, cond: { stage: 51 } },
    { count: 15, cond: { stage: 61 }, monthCard: { stage: 41 } },
    { count: 20, cond: { chest: 12 }, monthCard: { chest: 8 } },
    { count: 30, cond: { stage: 81 }, monthCard: { stage: 61 } },
    { count: 40, cond: { chest: 15 }, monthCard: { chest: 12 } },
    { count: 50, cond: { stage: 91 }, monthCard: { stage: 81 } },
    { count: 60, cond: { chest: 18 }, monthCard: { chest: 15 } },
  ],

  // ---------- 自動開箱 ----------
  autoOpen: {
    intervalMs: 600,
    fastIntervalMs: 300,
    // 自動開爐：符合全部條件的法寶 → 停止並跳比較視窗；其他一律分解
    defaults: {
      targetRarity: 4, // 目標品階序號：開到這個品階以上（4 = 天品）
      affix1: '', // 詞條條件 1：法寶必須帶有這個詞條（'' = 不指定；可選 subStats 的鍵）
      affix2: '', // 詞條條件 2
      requireBetter: true, // 只保留戰力高於目前裝備的
      batch: 1, // 一次開爐件數（只能選已解鎖的檔位）
      speed: 1, // 1 或 2
    },
  },

  // ---------- 戰鬥 ----------
  battle: {
    tickSec: 0.05, // 戰鬥邏輯固定步長（秒），越小越精確
    defFactor: 0.5, // 基礎傷害 = max(atk - def × defFactor, atk × minDamageRatio)
    minDamageRatio: 0.1,
    maxCatchupSec: 3600, // 分頁在背景 / 被節流時，回來最多補算幾秒戰鬥（更久的交給離線收益）
    maxVisualSteps: 20, // 一次補算超過這麼多步就不播放傷害數字等特效
    monsterDelaySec: 0.5, // 擊敗小怪後，下一隻出現前的間隔
    clearDelaySec: 1.0, // 通關後進入下一關前的間隔
    defeatDelaySec: 1.5, // 戰敗後重新挑戰前的間隔
  },

  // ---------- 主線關卡 ----------
  stage: {
    chapters: 10,
    levelsPerChapter: 10, // 每章最後一關為 Boss 關
    monstersPerStage: 5,
    retreatAfterFails: 3, // 連續失敗幾次後退回前一關
  },

  // ---------- 怪物數值 ----------
  // 小怪 HP / ATK / DEF = base × growth^(總關卡數)
  monster: {
    hpBase: 40,
    atkBase: 6,
    defBase: 2,
    growth: 1.07, // 原規格 1.12，第二階段模擬後調整
    spd: 0.8,
    critRate: 0,
    critDmg: 1,
    lifesteal: 0,
    dodge: 0,
  },
  boss: {
    hpMult: 2.5, // 原規格 5 → 4 → 2.5；每章 Boss 不要變成一道好幾天的高牆，讓進度平均分散
    atkMult: 2,
    defMult: 1.5,
    spd: 0.7,
    timeLimitSec: 30,
    // 戰意：挑戰 Boss 失敗一次，攻擊與氣血各 +perStack（最多 maxStacks 層）；擊敗該 Boss 後歸零。退回前一關也會保留
    fury: { perStack: 0.05, maxStacks: 10 },
    // 主線 Boss 氣血補償（只套用主線 Boss；鎮妖塔、上古妖王不受影響）。1 = 不補償
    // 1.5：時間型機制調整後模擬 1.0／1.2／1.5／2.0，只有 1.5 讓每天 2／4 小時都和 6-1 前差 ±5% 內（PLAN.md 2.13，2026-11-13）
    // 2.3：加入道途天賦後，劍修最佳天賦組合回到 6-1 後的破關天數（3.73／2.40 天）±5% 內（PLAN.md 2.14，2026-11-14 使用者同意）
    // 4.0：6-3（強化里程碑）＋6-4（靈獸羈絆、升星技能）之後統一校準，256 次模擬 −0.8%／+2.5%（PLAN.md 2.16，2026-11-14 使用者同意）
    mainHpComp: 4.0,
    // 補償從第幾章開始乘（之前的章 ×1）。道途與天賦在第 41 關（第 5 章）才開，前幾章不補償（2026-11-14 使用者決定）
    mainHpCompFromChapter: 5,
  },

  // ---------- 主線 Boss 機制（第五階段 6-1，使用者已確認） ----------
  // 每章一筆（索引 0 = 第 1 章）；null = 沒有機制。只套用在主線 Boss，鎮妖塔、上古妖王不套用。
  //   desc：挑戰前顯示的說明；counter：克制方式；advice：輸給這個 Boss 時的建議
  //   status：true = 每秒持續生效，只在 Boss 身上顯示狀態圖示，不跳字
  bossMechanics: [
    null,
    { id: 'illusion', name: '幻影', icon: 'moon', status: true, dodgeBonus: 0.25,
      desc: '閃避 +25%（只躲得掉一般攻擊；道途技能、靈獸、仙品雷擊照常命中）',
      counter: '道途技能、靈獸攻擊不會被閃避', advice: '建議多用道途技能與靈獸輸出' },
    { id: 'regen', name: '再生', icon: 'lotus', status: true, regenPct: 0.015,
      desc: '每秒回復 1.5% 最大氣血', counter: '高爆發的法修、會心傷害、斬殺類仙品', advice: '建議提升攻擊或會心傷害，在它回血前打倒它' },
    { id: 'noLifesteal', name: '屍毒', icon: 'm-skull', status: true,
      desc: '主角的吸血無效（仙品的回血特效照常觸發）', counter: '體修減傷、氣血、閃避', advice: '建議提升氣血、護體或閃避' },
    { id: 'poison', name: '劇毒', icon: 'gourd', status: true, poisonPct: 0.01,
      desc: '主角每秒損失 1% 最大氣血（無視護體與減傷）', counter: '吸血、氣血、速戰速決', advice: '建議提升攻擊或氣血' },
    // 鬼甲：開戰立即觸發第一次，之後每 interval 秒一次（2026-11-13 使用者決定）
    { id: 'ghostShield', name: '鬼甲', icon: 'bell', interval: 8, duration: 3, reduction: 0.7,
      desc: '開戰立即獲得 3 秒護盾，之後每 8 秒一次；護盾期間受到的所有傷害（一般攻擊、道途技能、靈獸、仙品雷擊）減少 70%',
      counter: '持續輸出、冷卻縮減、身法', advice: '建議提升攻擊或冷卻縮減，在護盾消失的空檔集中輸出' },
    { id: 'stoneSkin', name: '石膚', icon: 'mountain', status: true, defMult: 2, critTakenMult: 1.3,
      desc: '護體 ×2；但主角對它的會心傷害 ×1.3', counter: '會心率、劍修', advice: '建議提升會心率，或改修劍修' },
    { id: 'backlash', name: '反噬', icon: 'cycle', reflectPct: 0.15, reflectCapPct: 0.05,
      desc: '主角的一般攻擊會心時，自己受到該次傷害 15% 的反彈（每次最多主角最大氣血的 5%）',
      counter: '不靠會心的法修、體修，吸血', advice: '建議提升氣血或吸血，或改修法修、體修' },
    // 雷霆：第一次在開戰 firstAt 秒，之後每 interval 秒；單次傷害上限 = 主角最大氣血 × capPct（減傷後）（2026-11-13 使用者決定）
    { id: 'thunder', name: '雷霆', icon: 'lightning', firstAt: 3, interval: 6, mult: 3, capPct: 0.5,
      desc: '開戰 3 秒降下第一道雷擊，之後每 6 秒一道，造成 3 倍攻擊的傷害（可以閃避，會被減傷；每道最多主角最大氣血的 50%）',
      counter: '閃避、體修護盾、氣血', advice: '建議提升氣血、閃避，或改修體修，撐過兩道雷擊' },
    // 狂暴：Boss 氣血降到 hpBelow 以下時觸發一次（2026-11-13 使用者決定，不再用時間）
    { id: 'enrage', name: '狂暴', icon: 'seal', hpBelow: 0.5, atkMult: 2,
      desc: '氣血降到 50% 時狂暴，攻擊 ×2（限時仍是 30 秒）', counter: '後半段一口氣打完：高爆發、氣血、吸血', advice: '建議提升攻擊或氣血，狂暴後盡快打倒它' },
  ],
  // 輸給主線 Boss 時的死因（{boss} 換成 Boss 名稱）與沒有機制時的建議
  bossDeathCauses: {
    attack: '被{boss}擊敗',
    poison: '被劇毒擊敗',
    thunder: '被雷霆擊敗',
    backlash: '被反噬擊敗',
    enrage: '被狂暴的{boss}擊敗',
    timeout: '一炷香已盡，沒能擊敗{boss}',
  },
  bossDefaultAdvice: '建議開爐換更好的法寶，或升階煉器爐',

  // ---------- 章節首殺獎勵（第五階段 6-1，使用者已確認） ----------
  // 第一次擊敗每章 Boss 時另外發放（在 stageRewards 的 Boss 首殺獎勵之外）；索引 0 = 第 1 章
  //   items[].realm：法寶用該章的套裝外觀（等級是發放當下的法寶等級）
  //   新玩家直接發放並播放「章節通關」演出；存檔 v9 遷移時，已通過的章節改寄到信箱（不設期限）
  chapterRewards: [
    { items: [{ rarity: 3, realm: 1 }], eggs: 1 },
    { items: [{ rarity: 3, realm: 2 }], eggs: 1 },
    { items: [{ rarity: 3, realm: 3 }], eggs: 1 },
    { items: [{ rarity: 4, realm: 4 }], eggs: 1, iron: 5 },
    { items: [{ rarity: 4, realm: 5 }], eggs: 1, iron: 5 },
    { items: [{ rarity: 4, realm: 6 }], eggs: 1, iron: 5 },
    { items: [{ rarity: 4, realm: 7 }], eggs: 2, iron: 10 },
    { items: [{ rarity: 4, realm: 8 }], eggs: 2, iron: 10 },
    { items: [{ rarity: 4, realm: 9 }], eggs: 2, iron: 10 },
    { cosmetic: 'hundun' },
  ],

  // 每個境界（章）的名稱
  realms: ['練氣期', '築基期', '結丹期', '元嬰期', '化神期', '煉虛期', '合體期', '大乘期', '渡劫期', '真仙境'],

  // 每個境界的妖獸名稱、外觀與顏色（索引 0 = 第 1 章）
  // emoji / bossEmoji 欄位存放圖示名稱（定義在 icons.js）
  chapterMonsters: [
    { name: '山魈', emoji: 'm-ape', color: '#5b6b3a', bossName: '赤目山魈王', bossEmoji: 'm-ape' },
    { name: '狐妖', emoji: 'm-fox', color: '#a0522d', bossName: '九尾天狐', bossEmoji: 'm-fox' },
    { name: '樹妖', emoji: 'm-tree', color: '#3f6b4a', bossName: '千年樹妖', bossEmoji: 'm-tree' },
    { name: '屍傀', emoji: 'm-skull', color: '#5e5a52', bossName: '萬骨屍王', bossEmoji: 'm-skull' },
    { name: '蛛妖', emoji: 'm-spider', color: '#5b3b6e', bossName: '蛛母', bossEmoji: 'm-spider' },
    { name: '怨靈', emoji: 'm-ghost', color: '#3b5f6e', bossName: '幽冥鬼王', bossEmoji: 'm-ghost' },
    { name: '石魔', emoji: 'm-golem', color: '#6b5d4a', bossName: '太古石魔', bossEmoji: 'm-golem' },
    { name: '魔修', emoji: 'm-demon', color: '#8a2a22', bossName: '天魔尊者', bossEmoji: 'm-demon' },
    { name: '蛟龍', emoji: 'm-dragon', color: '#2f5f6b', bossName: '應龍', bossEmoji: 'm-dragon' },
    { name: '混沌獸', emoji: 'm-chaos', color: '#4a3a6b', bossName: '混沌魔神', bossEmoji: 'm-chaos' },
  ],

  // ---------- 主線獎勵 ----------
  stageRewards: {
    killGoldBase: 5, // 每隻小怪金幣 = killGoldBase × (1 + 總關卡數 × killGoldScale)
    killGoldScale: 0.2,
    clearKeysMin: 1, // 通關一般關卡的鑰匙（原 2～3：鑰匙太多會讓高品階法寶太早湊齊，中期一下就過了）
    clearKeysMax: 1,
    bossFirstKeys: 10, // 首次通關 Boss
    bossFirstStones: 1,
    bossFirstGoldPerChapter: 500, // 金幣 = 此值 × 章
    bossRepeatKeys: 3, // 重複通關 Boss
    // 爐火符收入隨境界成長（方案 C，已確認；0 = 不成長）：
    //   通關、Boss、閉關、妖獸潮的爐火符 × (1 + 最高通關總關卡數 × keyGrowthPerStage)
    keyGrowthPerStage: 0.03, // 方案 C（使用者已確認）：第 50 關 2.5 倍、第 90 關 3.7 倍
  },

  // ---------- 副本 ----------
  // 各秘境的開放條件見功能開放表（dungeon／dungeonKey／dungeonTower／dungeonWorldBoss）；
  // 難度的 unlockStage：最高通關總關卡數達到此值才能選這個難度
  dungeons: {
    dailyFree: 3, // 每日免費次數（試煉之塔除外），每天本地時間 00:00 重置
    // 掃蕩：打過的難度可以直接領取「該難度最佳紀錄」的獎勵（消耗一次次數；鎮妖塔沒有掃蕩）
    sweepEnabled: true,
    buyCost: 10, // 多買一次消耗的仙玉
    maxBuysPerDay: 1, // 每個秘境每天最多買幾次
    // 秘境的水墨場景（戰鬥區背景）
    scenes: { gold: 'bamboo', key: 'valley', tower: 'tower', worldBoss: 'blood' },

    // 金幣副本：限時攻擊不會反擊的木樁，金幣 = 總傷害 × goldPerDamage × 難度倍率
    gold: {
      name: '靈石秘境',
      icon: 'cave',
      durationSec: 30,
      goldPerDamage: 0.5,
      difficulties: [
        { mult: 1, unlockStage: 5 },
        { mult: 1.5, unlockStage: 21 },
        { mult: 2.2, unlockStage: 41 },
        { mult: 3, unlockStage: 61 },
        { mult: 4, unlockStage: 81 },
      ],
    },

    // 鑰匙副本：連續波次，戰敗即結束
    // 怪物強度 = 最高通關關卡的小怪數值 × baseStatMult × (1 + 波數 × waveScale) × 難度 statMult
    key: {
      name: '妖獸潮',
      icon: 'm-fox',
      maxWaves: 10,
      monstersPerWave: 3,
      waveScale: 0.1,
      keysPerWave: 2, // 每清一波的鑰匙 × 難度 keyMult
      eggDrops: { 5: 0.4, 10: 0.8 }, // 第 5、10 波清完時掉落靈獸蛋的機率
      eggPityStep: 0.2, // 靈獸蛋保底：每次沒掉，下次掉落機率 +20%（第 5、10 波共用，掉了才歸零）
      // 怪物基礎強度再乘上此值。玩家在主線最前線本來就打得很勉強，
      // 所以副本要比最前線弱，靠波數加成慢慢變難
      baseStatMult: 0.5,
      // 難度主要提高獎勵，怪物強度只小幅增加（高難度不能超過主線最前線，否則一波都打不過）
      difficulties: [
        { statMult: 1, keyMult: 1, unlockStage: 11 },
        { statMult: 1.1, keyMult: 1.5, unlockStage: 41 },
        { statMult: 1.2, keyMult: 2, unlockStage: 71 },
      ],
    },

    // 試煉之塔：第 N 層 = 主線總關卡數 N 的 Boss 數值 × statMult；無每日次數限制
    tower: {
      name: '鎮妖塔',
      icon: 'pagoda',
      statMult: 0.8,
      timeLimitSec: 30, // 每層限時（同主線 Boss）
      stonesEvery5: 1, // 每 5 層 +1 顆升級石
      extraStonesEvery10: 2, // 每 10 層額外 +2 顆
      // 每 10 層首次通過的大獎：一定給靈獸蛋，另外隨機「仙玉」或「高品階法寶」
      bigReward: { eggs: 1, stones: 3, itemChance: 0.5, itemRarities: [3, 4] }, // 3 = 地品、4 = 天品
      // D2（2026-11-20 使用者確認，PLAN.md 2.27 第 3 段）
      // 快速登塔：從下一層開始連續挑戰、直接結算（不播戰鬥），打到輸或最多 quickMaxFloors 層；獎勵和親自打一樣，算一次挑戰
      quickMaxFloors: 20,
      // 每日塔俸（掃蕩）：每天一次，依歷史最高層直接領；最高層 ≥ minFloor 才能領；也算一次挑戰（每日任務鎮妖塔、掃蕩）
      //   仙玉 = ⌊最高層 ÷ stonesPer⌋ × stones；玄鐵 = ⌊最高層 ÷ ironPer⌋ × iron（聚寶加成）。沒領的不累積
      sweep: { minFloor: 10, stonesPer: 50, stones: 1, ironPer: 25, iron: 1 },
    },

    // 世界 Boss：不會死亡，依總傷害達到的區間給獎勵（達到的每個區間都會給）
    // Boss 數值 = 最高通關關卡的 Boss 數值 × atkMult / defMult
    // 區間門檻 = hpMult × 最高通關關卡的小怪 HP（隨進度成長）
    // 金幣獎勵 = gold × (1 + 最高通關關卡 × stageRewards.killGoldScale)
    worldBoss: {
      name: '上古妖王',
      icon: 'taotie',
      durationSec: 60,
      atkMult: 0.15, // 太高的話主角撐不滿 60 秒
      defMult: 1,
      spd: 0.7,
      bossName: '饕餮',
      bossEmoji: 'taotie',
      bossColor: '#8a2a22',
      tiers: [
        { hpMult: 5, gold: 400, keys: 3, stones: 0 },
        { hpMult: 12, gold: 800, keys: 5, stones: 1 },
        { hpMult: 25, gold: 1500, keys: 8, stones: 1 },
        { hpMult: 45, gold: 2500, keys: 10, stones: 2, iron: 1 },
        { hpMult: 75, gold: 4000, keys: 15, stones: 2, iron: 1 },
        { hpMult: 120, gold: 6000, keys: 20, stones: 3, iron: 2 },
      ],
    },

    goldDummy: { name: '靈石傀儡', emoji: 'puppet', color: '#8a6d2f' },
    endDelaySec: 0.8, // 戰鬥結束到跳出結算的間隔
    nextDelaySec: 0.5, // 下一隻 / 下一層出現前的間隔
  },

  // ---------- 離線（閉關）收益 ----------
  // 每分鐘靈石 = 目前關卡每分鐘平均靈石產出 × goldRatio
  //   平均產出 = 在線時實際記錄的主線靈石收益（移動平均）；記錄不足時用「小怪靈石 × estKillsPerMinute」估算
  // 爐火符：每 minutesPerKey 分鐘 keysPerInterval 張
  // 裝置時間倒退（例如手動調時間）時，本次收益為 0
  offline: {
    maxHours: 12, // 最多累積時數，超過不再累積
    goldRatio: 0.8,
    minutesPerKey: 5, // 每隔幾分鐘給一次爐火符
    keysPerInterval: 1, // 每次給幾張爐火符
    estKillsPerMinute: 12, // 沒有在線紀錄時估算用：每分鐘擊殺數
    rateSmoothing: 0.2, // 移動平均的權重（每分鐘更新一次；越大越快反映最近的收益）
    minSamples: 3, // 至少記錄幾分鐘的在線收益才採用
    minMinutes: 1, // 離線少於這麼多分鐘不跳視窗
    rollbackToleranceMs: 60000, // 時間倒退超過這麼多才判定為異常（避免時鐘微調誤判）
    doubleCost: 0, // 雙倍領取消耗的仙玉（0 = 免費，閉關視窗只顯示一個「雙倍領取」按鈕）
    doubleMult: { gold: 1, keys: 2 }, // 雙倍領取時各資源的倍率（目前只有爐火符雙倍，避免閉關靈石比在線還多）
  },

  // ---------- 戰鬥演出 ----------
  fx: {
    bossSlowMs: 700, // 擊殺妖王時的慢動作長度（真實時間）
    bossSlowScale: 0.25, // 慢動作期間戰鬥時間的速度
    numberRollMs: 450, // 貨幣數字滾動的時間
    ceremonyMs: 2400, // 全螢幕演出（天劫、升爐、入道）的長度
    ceremonyFadeMs: 400, // 全螢幕演出淡出的時間
    tribulationDelayMs: 300, // 斬殺章節妖王後，天劫演出延後多久出現
    achievePopMs: 2600, // 成就提示停留時間
    achievePopGapMs: 350, // 多個成就提示之間的間隔
    hatchRevealMs: 700, // 孵蛋：蛋裂開後多久顯示結果
    coachRepositionMs: 320, // 新手引導：等視窗動畫結束後重新對位
    // 提示訊息（toast）停留時間
    toast: { short: 1200, medium: 1500, normal: 1800, long: 2500, boss: 3000, extra: 3500 },
    toastFadeMs: 400, // 提示訊息淡出的時間
  },

  // ---------- 開爐動畫 ----------
  chestAnim: {
    revealDelayMs: 800, // 手動開爐：爐火燒多久後才顯示結果 / 比較視窗
    goldLightFromRarity: 3, // 開到此品質序號以上時放出金光（3 = 地品）
    goldLightHoldMs: 700, // 放出金光時，比較視窗再延後多久出現
    runeMs: 1800, // 天品以上：全螢幕金光 + 符文陣展開的時間（之後才揭曉）
    mythicHoldMs: 900, // 仙品：再停頓顯示專屬名稱與介紹
    runeFromRarity: 4, // 開到此品質序號以上播放符文陣（4 = 天品）
    mythicRarity: 5, // 仙品的品質序號（加震動、專屬音效與名稱）
    runeLeadMs: 150, // 符文陣比揭曉提早多久開始
    runeShakeAt: 0.6, // 仙品震動在符文陣播到幾成時發生
    runeFadeMs: 250, // 符文陣結束後淡出的時間
    autoBurnMs: 260, // 自動開爐時爐火的短動畫
    burnTailMs: 200, // 爐火動畫結束後再保留的時間
    glowLeadMs: 160, // 爐口光芒比爐火結束提早多久出現
  },

  // ---------- 音效（Web Audio 即時合成，不需要音效檔） ----------
  sound: {
    volume: 0.35, // 音效總音量 0 ~ 1（再乘上設定頁的音效音量）
    musicVolume: 0.35, // 音樂總音量 0 ~ 1（再乘上設定頁的音樂音量）
    defaultMusicVolume: 0.5, // 設定頁「音樂音量」的預設值
    defaultSfxVolume: 0.8, // 設定頁「音效音量」的預設值
    sfxBoost: 1.6, // 音效整體增益（合成音色本身音量較小）
    hitThrottleMs: 90, // 攻擊音效最短間隔，避免攻速很高時太吵
  },

  // ---------- 道途 ----------
  // bonus：屬性加成（atkPct / hpPct / defPct 為百分比加成；critRate 直接相加）
  // skill.type：'damage' 每 cooldown 秒造成 mult 倍攻擊傷害；
  //             'shield' 每 cooldown 秒獲得 duration 秒、減傷 reduction 的護體
  // skill.castAtStart：每場戰鬥一開始立即施放一次（之後照冷卻）
  // talents：每一轉二選一的天賦（第五階段 6-2，使用者已確認）；talents[0] = 一轉、talents[1] = 二轉
  //   選道途時選一轉天賦、突破二轉時選二轉天賦；改選花 rerollCost 仙玉，改修其他道途時天賦清空、重選免費
  //   effect 欄位：
  //     skillCrit       道途技能可以會心（用主角的會心率、會心傷害）
  //     cooldownAdd     技能冷卻加減（秒）
  //     multAdd         技能倍率加減
  //     durationAdd     護體持續加減（秒）
  //     castAtStart     開戰立即施放一次技能
  //     firstCooldownMult  每場戰鬥第一次施放只要冷卻 × 這個倍率（0.5 = 首次冷卻減半）
  //     executeBelow / executeMult  敵人氣血低於 executeBelow 時，技能傷害 × executeMult
  //     critHealPct     一般攻擊會心時回復最大氣血的比例（不是吸血，屍毒下也有效）
  //     noHpPenalty     取消道途的氣血減少
  //     recastChance    技能施放後再施放一次的機率（再施放的那一次不會再觸發）
  //     pierceShield    技能無視目標的護盾減傷（鬼甲）；pierceDef：技能計算時目標護體 × (1 - pierceDef)
  //     reflectPct      護體期間，把受到的一般攻擊傷害（減傷後）的這個比例反彈給攻擊者
  //     shieldAtkPct    護體期間攻擊 +比例
  //     lowHpBelow / lowHpAtkPct  氣血低於 lowHpBelow 時攻擊 +lowHpAtkPct（一般攻擊、技能、靈獸都算）
  //   good：適合對付的 Boss（畫面顯示）
  dao: {
    // 開放條件見功能開放表：dao（道途）、daoAscend（二轉）
    rerollCost: 5, // 改修其他道途消耗的仙玉（第一次選擇免費）
    order: ['sword', 'spell', 'body'],
    paths: {
      sword: {
        icon: 'sword',
        color: '#2c5d8f',
        desc: '以劍入道，出手凌厲，擅長會心一擊',
        tiers: [
          {
            name: '劍修',
            bonus: { atkPct: 0.2, critRate: 0.1 },
            skill: { name: '御劍術', type: 'damage', cooldown: 5, mult: 3 },
          },
          {
            name: '劍仙',
            bonus: { atkPct: 0.35, critRate: 0.15 },
            skill: { name: '萬劍歸宗', type: 'damage', cooldown: 4, mult: 4 },
          },
        ],
        talents: [
          [
            { id: 'swordCrit', name: '劍心通明', desc: '御劍術可以會心', effect: { skillCrit: true }, good: '石膚（會心傷害 ×1.3）' },
            // 2026-11-15 調整（使用者同意）：冷卻 −1 秒 → 冷卻 −1 秒、技能倍率 +2
            { id: 'swordQuick', name: '快劍', desc: '技能冷卻 −1 秒、技能倍率 +2', effect: { cooldownAdd: -1, multAdd: 2 }, good: '幻影、鬼甲（多出手）' },
          ],
          [
            { id: 'swordExecute', name: '一擊必殺', desc: '敵人氣血低於 30% 時，技能傷害 ×2', effect: { executeBelow: 0.3, executeMult: 2 }, good: '再生、狂暴（收尾）' },
            { id: 'swordAura', name: '劍氣護體', desc: '一般攻擊會心時回復 1% 最大氣血（屍毒下也有效）。只對一般攻擊的會心有效，技能會心不算', effect: { critHealPct: 0.01 }, good: '反噬、劇毒（續航）' },
          ],
        ],
      },
      spell: {
        icon: 'lightning',
        color: '#6b3f95',
        desc: '引天雷入體，以身軀換取極致法力',
        tiers: [
          {
            name: '法修',
            bonus: { atkPct: 0.3, hpPct: -0.1 },
            skill: { name: '五雷正法', type: 'damage', cooldown: 8, mult: 5 },
          },
          {
            name: '雷尊',
            bonus: { atkPct: 0.5, hpPct: -0.05 },
            skill: { name: '九霄神雷', type: 'damage', cooldown: 7, mult: 7 },
          },
        ],
        talents: [
          [
            // 2026-11-14 第二次調整（使用者同意）：開戰立即施放（×0.5）→ 每場戰鬥首次冷卻減半
            { id: 'spellFirst', name: '先發制人', desc: '每場戰鬥第一次施放技能，冷卻減半', effect: { firstCooldownMult: 0.5 }, good: '狂暴、雷霆（速戰）' },
            // 2026-11-15 調整（使用者同意 S3）：取消技能倍率 −1，改成技能冷卻 −1 秒
            { id: 'spellBody', name: '雷體', desc: '取消道途的氣血減少，技能冷卻 −1 秒', effect: { noHpPenalty: true, cooldownAdd: -1 }, good: '劇毒、雷霆（耐打）' },
          ],
          [
            { id: 'spellChain', name: '連雷', desc: '技能施放後 30% 機率再施放一次', effect: { recastChance: 0.3 }, good: '再生' },
            { id: 'spellPierce', name: '破甲神雷', desc: '技能無視鬼甲的減傷，並無視一半護體', effect: { pierceShield: true, pierceDef: 0.5 }, good: '鬼甲、石膚' },
          ],
        ],
      },
      body: {
        icon: 'bell',
        color: '#8a5a1c',
        desc: '錘煉肉身，以不壞之軀硬撼妖魔',
        tiers: [
          // 6-2 平衡（方案 A4，使用者已確認）：開戰立即開護體＋攻擊加成
          // 2026-11-14 調整（使用者同意 A＋B）：攻擊 +5%／+10% → +0%／+5%
          {
            name: '體修',
            bonus: { hpPct: 0.4, defPct: 0.2, atkPct: 0 },
            skill: { name: '金剛不壞', type: 'shield', cooldown: 10, duration: 3, reduction: 0.5, castAtStart: true },
          },
          {
            name: '體聖',
            bonus: { hpPct: 0.6, defPct: 0.35, atkPct: 0.05 },
            skill: { name: '不滅金身', type: 'shield', cooldown: 9, duration: 4, reduction: 0.6, castAtStart: true },
          },
        ],
        talents: [
          [
            // 2026-11-14 調整（使用者同意建議 3）：反彈 30% → 10%、護體 +2 秒 → +1 秒
            // 2026-11-15 調整（使用者同意 B3）：反彈 10% → 20%，護體持續 +0.5 秒
            { id: 'bodyReflect', name: '金鐘罩', desc: '護體期間反彈受到傷害的 20%，以傷還傷（護體持續 +0.5 秒）', effect: { reflectPct: 0.2, durationAdd: 0.5 }, good: '狂暴（越痛反彈越多）' },
            { id: 'bodyIron', name: '鐵骨', desc: '護體持續 +1 秒', effect: { durationAdd: 1 }, good: '雷霆' },
          ],
          [
            // 2026-11-14 調整（使用者同意建議 2）：+30% → +10%；再調整（使用者同意 A＋B）：+10% → +5%
            { id: 'bodyImmovable', name: '不動明王', desc: '護體期間攻擊 +5%', effect: { shieldAtkPct: 0.05 }, good: '鬼甲、狂暴（爆發）' },
            // 2026-11-14 第二次調整（使用者同意）：吸血型 → 攻擊型
            { id: 'bodyBlood', name: '浴血', desc: '氣血低於 50% 時攻擊 +20%', effect: { lowHpBelow: 0.5, lowHpAtkPct: 0.2 }, good: '劇毒、反噬（越打越兇）' },
          ],
        ],
      },
    },
  },

  // ---------- 靈獸 ----------
  // 被動加成 = passive × rarityMult[品階] × (1 + starBonus × (星數 - 1))
  // 自動攻擊 = 每 cooldown 秒造成「主角攻擊 × mult × skillRarityMult[品階] × (1 + starBonus × (星數 - 1))」的傷害
  beasts: {
    hatchRates: [45, 28, 16, 8, 2.6, 0.4], // 孵化品階機率（%）：凡品～仙品
    rarityMult: [1, 1.4, 1.9, 2.6, 3.5, 4.8],
    skillRarityMult: [1, 1.15, 1.3, 1.5, 1.75, 2.1],
    starMax: 5,
    starBonus: 0.25, // 每升一星，加成與攻擊 +25%
    starCost: [10, 20, 40, 80], // 1→2、2→3、3→4、4→5 星所需的靈獸精魄
    essenceByRarity: [2, 4, 8, 16, 32, 64], // 重複的靈獸轉成精魄的數量
    // 靈獸分頁與第 2 個上陣欄位的開放條件見功能開放表：beast、beastSlot2
    order: ['fox', 'turtle', 'bird', 'marten', 'crane', 'qilin'],
    species: {
      fox: { name: '靈狐', icon: 'b-fox', color: '#a0522d', desc: '通人性的白狐，狐火可焚妖邪',
        passive: { atkPct: 0.04 }, skill: { name: '狐火', cooldown: 4, mult: 1.2 } },
      turtle: { name: '玄龜', icon: 'b-turtle', color: '#2f5f6b', desc: '背負玄甲，壽與天齊',
        passive: { hpPct: 0.06 }, skill: { name: '玄甲衝撞', cooldown: 6, mult: 1.6 } },
      bird: { name: '赤焰鳥', icon: 'b-bird', color: '#b3261e', desc: '浴火而生，羽翼燃燒不滅之焰',
        passive: { critRate: 0.02 }, skill: { name: '赤焰焚天', cooldown: 5, mult: 1.8 } },
      marten: { name: '雷貂', icon: 'b-marten', color: '#6b3f95', desc: '迅如奔雷，爪帶電光',
        passive: { spd: 0.04 }, skill: { name: '奔雷爪', cooldown: 3, mult: 0.9 } },
      crane: { name: '白鶴', icon: 'b-crane', color: '#4a6b6b', desc: '仙人座騎，所到之處靈氣匯聚',
        passive: { goldPct: 0.08 }, skill: { name: '鶴唳九霄', cooldown: 6, mult: 1.4 } },
      qilin: { name: '麒麟', icon: 'b-qilin', color: '#b5791c', desc: '上古瑞獸，只以仙品之姿現世',
        onlyRarity: 5, passive: { atkPct: 0.03, hpPct: 0.03 }, skill: { name: '麒麟踏焰', cooldown: 5, mult: 2.5 } },
    },
    // 靈獸羈絆（第五階段 6-4，使用者已確認）：上陣的兩隻符合 pair 時生效（上陣只有 2 格，同時只有一組）
    //   bonus：屬性加成（併入靈獸加成，計入戰力）；effect：小特效（petDmgPct 靈獸傷害 +、attackTakenReduce 受到的一般攻擊 −；不計入戰力）
    //   core：和任一隻同時上陣就生效；partnerPassiveMult：另一隻的被動加成倍率
    bonds: [
      { id: 'foxBird', name: '狐火燎原', pair: ['fox', 'bird'], effect: { petDmgPct: 0.2 }, desc: '靈獸傷害 +20%' },
      { id: 'turtleMarten', name: '玄甲雷鳴', pair: ['turtle', 'marten'], effect: { attackTakenReduce: 0.05 }, desc: '受到的一般攻擊 −5%' },
      { id: 'craneMarten', name: '鶴舞清風', pair: ['crane', 'marten'], bonus: { spd: 0.03 }, desc: '身法 +0.03' },
      { id: 'birdTurtle', name: '赤羽玄甲', pair: ['bird', 'turtle'], bonus: { hpPct: 0.04, critRate: 0.01 }, desc: '氣血 +4%、會心率 +1%' },
      { id: 'foxCrane', name: '狐鶴同遊', pair: ['fox', 'crane'], bonus: { atkPct: 0.03 }, desc: '攻擊 +3%' },
      { id: 'qilinCore', name: '麒麟護主', core: 'qilin', partnerPassiveMult: 1.5, desc: '另一隻靈獸的被動加成 ×1.5' },
    ],
    // 靈獸覺醒（B3，PLAN.md 2.25；使用者 2026-11-19 選方案 A，數值暫定：做方案 Z 時重新檢查）
    //   條件：功能 beastAwaken 已開放、這隻靈獸 starMax 星（不限品階）；每隻一次，飛升不重置
    //   cost：每隻消耗的精魄
    //   scaleMult：覺醒加成，被動加成與技能倍率 ×scaleMult（上陣時）
    //   opener：先手，每場戰鬥開始立刻出手一次（含覺醒技效果），之後照原本冷卻（battle.js 的 createBattle）
    //   resonance：覺醒共鳴，每覺醒一隻（不必上陣），主角加成 × 隻數（和其他加成相乘；一般靈獸 5 隻＋麒麟最多 6 隻）
    //   skills：覺醒技，name 取代技能名稱，其他欄位覆蓋 starSkills.effects（4 星專屬效果；buffCritDmg 會心傷害 +）
    awaken: {
      cost: 150,
      scaleMult: 1.3,
      opener: true,
      resonance: { atkPct: 0.02, hpPct: 0.02 },
      skills: {
        fox: { name: '九尾狐火', buffCritRate: 0.1, buffCritDmg: 0.3, buffSec: 3, desc: '命中後 3 秒內，主角會心率 +10%、會心傷害 +30%' },
        turtle: { name: '玄武鎮岳', buffDmgTaken: 0.35, buffSec: 3, desc: '施放後 3 秒內，主角受到的傷害 −35%' },
        bird: { name: '浴火焚天', bossDmgPct: 0.6, desc: '對 Boss 傷害 +60%' },
        marten: { name: '九霄奔雷', echoChance: 0.5, desc: '50% 機率再出手一次' },
        crane: { name: '鶴鳴九皋', healPct: 0.05, desc: '命中後回復主角 5% 最大氣血' },
        qilin: { name: '麒麟聖焰', buffAtkPct: 0.15, buffSec: 3, desc: '施放後 3 秒內，主角攻擊 +15%' },
      },
    },
    // 升星技能（第五階段 6-4，使用者決定門檻 2／4 星）
    //   levels[0] 星：技能倍率 ×(1 + multPct)；levels[1] 星：各靈獸的專屬效果（effects）
    //   專屬效果欄位：buffCritRate／buffAtkPct／buffDmgTaken + buffSec 命中或施放後主角獲得的短暫增益；
    //     bossDmgPct 對 Boss 傷害 +；echoChance 機率再出手一次（再出手的不會再觸發）；healPct 命中回復主角最大氣血比例
    starSkills: {
      levels: [2, 4],
      multPct: 0.25,
      effects: {
        fox: { buffCritRate: 0.05, buffSec: 3, desc: '命中後 3 秒內，主角會心率 +5%' },
        turtle: { buffDmgTaken: 0.2, buffSec: 2, desc: '施放後 2 秒內，主角受到的傷害 −20%' },
        bird: { bossDmgPct: 0.3, desc: '對 Boss 傷害 +30%' },
        marten: { echoChance: 0.25, desc: '25% 機率再出手一次' },
        crane: { healPct: 0.02, desc: '命中後回復主角 2% 最大氣血' },
        qilin: { buffAtkPct: 0.08, buffSec: 3, desc: '施放後 3 秒內，主角攻擊 +8%' },
      },
    },
  },

  // ---------- 每日任務池、每週任務、活躍度寶箱（6-5；daily.js） ----------
  // 每天 00:00 從任務池抽題，只抽「已開放、而且目前做得到」的任務（每日任務本身還沒開放時，等開放的那一刻才抽）
  //   track：進度計數器（不管有沒有抽到、功能有沒有開放都會累積）
  //   feature：需要已開放的功能；cond：額外的進度條件（同功能開放表）；need：抽題時要做得到（daily.js 的 DAILY_NEEDS）
  //   group：同一組一天最多抽 dailyTaskRules.groupMax[組] 個
  dailyTaskPool: [
    { id: 'kill', name: '斬妖除魔', desc: '在修煉中擊敗 {target} 隻妖獸', track: 'kill', target: 500 },
    { id: 'online', name: '勤修不輟', desc: '在線修煉 {target} 分鐘', track: 'online', target: 20 },
    { id: 'open', name: '開爐煉器', desc: '煉出 {target} 件法寶', track: 'open', target: 300 },
    { id: 'chestUp', name: '爐火精進', desc: '升爐 {target} 格', track: 'chestUp', target: 1, feature: 'chestUpgrade', need: 'chestNotMax' },
    { id: 'boss', name: '挑戰妖王', desc: '主線挑戰 Boss {target} 次（不論勝負）', track: 'bossTry', target: 2, cond: { stage: 10 } },
    { id: 'dungeon', name: '秘境歷練', desc: '進入或掃蕩秘境 {target} 次', track: 'dungeon', target: 3, feature: 'dungeon', group: 'dungeon' },
    { id: 'tide', name: '妖獸潮', desc: '挑戰妖獸潮 {target} 次', track: 'dungeonKey', target: 1, feature: 'dungeonKey', group: 'dungeon' },
    { id: 'tower', name: '鎮妖塔', desc: '挑戰鎮妖塔 {target} 次（不論勝負）', track: 'tower', target: 1, feature: 'dungeonTower', group: 'dungeon' },
    { id: 'worldBoss', name: '上古妖王', desc: '挑戰上古妖王 {target} 次', track: 'worldBoss', target: 1, feature: 'dungeonWorldBoss', group: 'dungeon' },
    { id: 'sweep', name: '掃蕩', desc: '掃蕩秘境 {target} 次', track: 'sweep', target: 1, feature: 'dungeon', need: 'hasSweep', group: 'dungeon' },
    { id: 'hatch', name: '靈獸孵化', desc: '孵化 {target} 顆靈獸蛋', track: 'hatch', target: 1, feature: 'beast', need: 'hasEgg' },
    { id: 'starUp', name: '靈獸升星', desc: '靈獸升星 {target} 次', track: 'starUp', target: 1, feature: 'beast', need: 'beastNotMax' },
    { id: 'enhance', name: '部位強化', desc: '強化部位 {target} 次', track: 'enhance', target: 3, feature: 'enhance', need: 'enhanceNotMax' },
    { id: 'reroll', name: '詞條洗練', desc: '洗練詞條 {target} 次', track: 'reroll', target: 1, feature: 'enhance', need: 'canReroll' },
    { id: 'market', name: '坊市採買', desc: '在坊市購買 {target} 件商品', track: 'market', target: 2, feature: 'market' },
  ],
  dailyTaskRules: {
    many: 5, // 可抽的任務 ≥ manyThreshold 個時抽 many 個，否則抽 few 個
    few: 4,
    manyThreshold: 8,
    groupMax: { dungeon: 2 }, // 秘境類一天最多 2 個
    activityTotal: 100, // 做完當天全部任務剛好拿到的活躍度（每個任務 = activityTotal ÷ 當天任務數）
    reward: { keys: 10 }, // 每個任務的獎勵（另加戰令經驗 pass.exp.perDailyTask）
  },
  // 活躍度寶箱：need = 活躍度門檻。每週活躍度 = 當週每日活躍度加總，週一 00:00 重置（weekStartDay：0 = 週日、1 = 週一）
  activity: {
    weekStartDay: 1,
    daily: [
      // 2026-11-16 加約 57%（換算仙玉 47 → 74），讓每天 4 小時的破關天數回到 ±5% 內（PLAN.md 2.19）
      { need: 40, reward: { eggs: 1, iron: 2 } },
      { need: 80, reward: { eggs: 1, iron: 2, essence: 10 } },
      { need: 100, reward: { eggs: 2, iron: 2, stones: 6 } },
    ],
    weekly: [
      { need: 150, reward: { iron: 3, essence: 10 } },
      { need: 300, reward: { eggs: 2, stones: 10 } },
      { need: 500, reward: { eggs: 3, stones: 20, iron: 5 } },
    ],
  },
  // 每週任務（戰令任務）：每週固定 5 個；feature 任一個沒開放時（抽題那一刻）改用 alt 替代任務
  weeklyTasks: [
    { id: 'w_daily', name: '日日精進', desc: '完成每日任務 {target} 個', track: 'dailyTask', target: 20 },
    { id: 'w_kill', name: '降妖伏魔', desc: '在修煉中擊敗 {target} 隻妖獸', track: 'kill', target: 8000 },
    { id: 'w_dungeon', name: '秘境探索', desc: '進入或掃蕩秘境 {target} 次', track: 'dungeon', target: 15, features: ['dungeon'],
      alt: { name: '爐火不熄', desc: '煉出 {target} 件法寶', track: 'open', target: 3000 } },
    { id: 'w_tower', name: '登塔挑王', desc: '挑戰鎮妖塔或上古妖王 {target} 次', track: 'towerOrBoss', target: 10, features: ['dungeonTower', 'dungeonWorldBoss'],
      alt: { name: '閉門苦修', desc: '在線修煉 {target} 分鐘', track: 'online', target: 300 } },
    { id: 'w_growth', name: '精益求精', desc: '強化、洗練、靈獸升星合計 {target} 次', track: 'growth', target: 10, features: ['enhance', 'beast'],
      alt: { name: '閉門苦修', desc: '在線修煉 {target} 分鐘', track: 'online', target: 300 } },
  ],
  weeklyTaskRules: {
    reward: { keys: 30 }, // 每個每週任務的獎勵（另加戰令經驗 pass.exp.perWeeklyTask）
  },

  // ---------- 裝備擴充：外觀資料、強化、圖鑑 ----------
  gear: {
    dataUrl: 'data/equipment.json', // 裝備外觀、套裝、仙品資料
    levelsPerRealm: 5, // 裝備等級每 5 級換下一個境界的外觀（1～5 級 = 練氣期）
    // 部位強化：強化等級屬於「部位」，換裝不會遺失
    enhance: {
      maxLevel: 15,
      statPerLevel: 0.06, // 每級：該部位法寶主屬性 +6%
      goldBase: 300, // 靈石 = goldBase × goldGrowth^目前等級 × (1 + 最高通關總關卡數 × stageScale)
      goldGrowth: 1.7, // 後期主要的靈石去處
      stageScale: 0.2,
      safeUntil: 15, // 到這一級（含）以前必定成功；15 = 全等級 100% 成功
      successRates: { 11: 0.8, 12: 0.7, 13: 0.6, 14: 0.5, 15: 0.4 }, // safeUntil 之後的成功率（目前不會用到）；失敗不降級
      ironCost: { 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 2, 12: 2, 13: 3, 14: 3, 15: 4 }, // +6 以上另外需要玄鐵（每日任務、上古妖王、坊市等），讓強化每天穩定成長
      // 強化里程碑（第五階段 6-3，使用者已確認；門檻 +4／+8／+12）：部位強化到 levels[i] 時解鎖 slots[部位][i]，一直生效
      //   bonus：屬性加成（atkPct／hpPct／defPct 獨立相乘，其他直接相加；計入戰力）
      //   effect：小特效（不計入戰力）
      //     skillDmgPct 道途技能傷害 +；skillTakenReduce 受到的技能類傷害（雷霆等）−；attackTakenReduce 受到的一般攻擊 −
      //     critExtra 一般攻擊會心時傷害再 ×(1+值)；firstCrit 每場戰鬥第一次一般攻擊必定會心；petDmgPct 靈獸傷害 +
      milestones: {
        levels: [4, 8, 12],
        // 2026-11-14 使用者決定：數值縮到提案的 ½（雲履首擊必會心不是數字，維持）；Boss 氣血補償等 6-4 做完再一起校準
        slots: {
          weapon: [{ bonus: { atkPct: 0.015 } }, { bonus: { critDmg: 0.05 } }, { effect: { skillDmgPct: 0.075 }, desc: '道途技能傷害 +7.5%' }],
          helmet: [{ bonus: { hpPct: 0.015 } }, { bonus: { dodge: 0.01 } }, { effect: { skillTakenReduce: 0.075 }, desc: '受到的技能類傷害（雷霆等）−7.5%' }],
          armor: [{ bonus: { defPct: 0.025 } }, { bonus: { hpPct: 0.025 } }, { effect: { attackTakenReduce: 0.04 }, desc: '受到的一般攻擊 −4%' }],
          gloves: [{ bonus: { atkPct: 0.015 } }, { bonus: { critRate: 0.015 } }, { effect: { critExtra: 0.1 }, desc: '會心時再追加 10% 傷害' }],
          boots: [{ bonus: { spd: 0.015 } }, { bonus: { dodge: 0.01 } }, { effect: { firstCrit: true }, desc: '每場戰鬥第一次出手必定會心' }],
          accessory: [{ bonus: { critDmg: 0.04 } }, { bonus: { lifesteal: 0.01 } }, { effect: { petDmgPct: 0.1 }, desc: '靈獸傷害 +10%' }],
        },
      },
    },
    // 詞條洗練（第五階段 6-3，使用者已確認）：選身上法寶的一條詞條重洗（種類和數值都重新隨機，種類不和其他詞條重複），其他詞條不動
    //   ironCost[品階序號]：每次花費的玄鐵（基準單位）；0 = 不能洗（凡品沒有詞條）
    //   洗完可以選「保留新的」或「還原舊的」（玄鐵洗的時候就扣）；選擇前的狀態不存檔，重新整理當作保留
    reroll: {
      ironCost: [0, 1, 1, 1, 2, 3, 5], // 神品 5（B2）
    },
    // 圖鑑收集獎勵（收集種類數達到 count 時可領）
    codexMilestones: [
      { count: 10, reward: { stones: 5 } },
      { count: 25, reward: { stones: 5, eggs: 1 } },
      { count: 50, reward: { stones: 10, iron: 5 } },
      { count: 80, reward: { stones: 10, eggs: 2 } },
      { count: 120, reward: { stones: 20, iron: 10 } },
      { count: 160, reward: { stones: 30, eggs: 3 } },
      { count: 192, reward: { stones: 50, eggs: 5 } },
      { count: 198, reward: { stones: 80, iron: 20 } }, // B2：加上 6 件神品專屬
    ],
    // 圖鑑套組加成（B2，使用者已確認 2026-11-18）：收集齊一組就永久生效（圖鑑開放後；atkPct／hpPct 與其他加成相乘）
    //   realm：某一個境界的 18 種外觀全收集（共 10 組）；mythic：仙品專屬 12 種；divine：神品專屬 6 種
    //   realmMinAscensions：境界套組要第幾次飛升後才生效（PR #2 審閱後使用者決定 2026-11-18：第一次飛升後；仙品、神品套組不限）
    // 圖鑑兌換（v1.1 V1，2026-11-22 使用者確認，PLAN.md 2.28）：用仙玉兌換「已經開不到」的境界外觀（外觀境界 < 目前開爐的外觀境界）
    //   只記錄圖鑑、不給法寶、不升存檔；codex.seen 記 seenValue（−1 = 兌換來的，畫面當凡品顯示並加「兌」字）
    //   之後開爐開到同一件外觀時，照常記成實際品階（recordCodex 的「品階較高就更新」），「兌」字自然消失
    //   price：每種仙玉（基準單位）；minAscensions：第幾次飛升後開放（和境界套組加成生效的時間相同）
    codexExchange: { minAscensions: 1, price: 200, seenValue: -1 },
    codexSets: {
      realmMinAscensions: 1,
      realm: { atkPct: 0.01, hpPct: 0.01 },
      mythic: { atkPct: 0.03, hpPct: 0.03 },
      divine: { atkPct: 0.05, hpPct: 0.05 },
    },
  },

  // ---------- 隨機獎勵表（寶匣、禮包內的隨機道具） ----------
  // weight：權重；機率 = 權重 / 總權重。購買前畫面會列出每種結果的機率
  // reward.items：[{ rarity: 品階序號 }]，隨機部位、目前境界等級的法寶
  lootTables: {
    xuanBox: {
      name: '玄品法寶匣',
      entries: [
        { weight: 70, label: '玄品法寶 ×1', reward: { items: [{ rarity: 2 }] } },
        { weight: 25, label: '地品法寶 ×1', reward: { items: [{ rarity: 3 }] } },
        { weight: 5, label: '天品法寶 ×1', reward: { items: [{ rarity: 4 }] } },
      ],
    },
    xianyuanBox: {
      name: '仙緣寶匣',
      entries: [
        { weight: 60, label: '天品法寶 ×1', reward: { items: [{ rarity: 4 }] } },
        { weight: 5, label: '仙品法寶 ×1', reward: { items: [{ rarity: 5 }] } },
        { weight: 25, label: '靈獸蛋 ×3', reward: { eggs: 3 } },
        { weight: 10, label: '玄鐵 ×{iron}', reward: { iron: 10 } },
      ],
    },
    // 首儲專屬：天品靈獸（麒麟只有仙品，不在此表）
    firstBeast: {
      name: '首儲天品靈獸',
      entries: [
        { weight: 1, label: '天品靈狐', reward: { beast: { key: 'fox', rarity: 4 } } },
        { weight: 1, label: '天品玄龜', reward: { beast: { key: 'turtle', rarity: 4 } } },
        { weight: 1, label: '天品赤焰鳥', reward: { beast: { key: 'bird', rarity: 4 } } },
        { weight: 1, label: '天品雷貂', reward: { beast: { key: 'marten', rarity: 4 } } },
        { weight: 1, label: '天品白鶴', reward: { beast: { key: 'crane', rarity: 4 } } },
      ],
    },
    // 累計儲值：仙品靈獸
    xianBeast: {
      name: '仙品靈獸',
      entries: [
        { weight: 1, label: '仙品靈狐', reward: { beast: { key: 'fox', rarity: 5 } } },
        { weight: 1, label: '仙品玄龜', reward: { beast: { key: 'turtle', rarity: 5 } } },
        { weight: 1, label: '仙品赤焰鳥', reward: { beast: { key: 'bird', rarity: 5 } } },
        { weight: 1, label: '仙品雷貂', reward: { beast: { key: 'marten', rarity: 5 } } },
        { weight: 1, label: '仙品白鶴', reward: { beast: { key: 'crane', rarity: 5 } } },
        { weight: 1, label: '仙品麒麟', reward: { beast: { key: 'qilin', rarity: 5 } } },
      ],
    },
    starterRandom: {
      name: '新手禮包隨機法寶',
      entries: [
        { weight: 90, label: '天品法寶 ×1', reward: { items: [{ rarity: 4 }] } },
        { weight: 10, label: '仙品法寶 ×1', reward: { items: [{ rarity: 5 }] } },
      ],
    },
  },

  // ---------- 成就 ----------
  // type：highest 最高境界層數、chest 煉器爐階數、tower 鎮妖塔層數、codex 圖鑑種類、beastsOwned 擁有靈獸種類、
  //       enhanceMax 任一部位強化等級、daoChosen 選擇道途、daoTier 道途轉數、stat:xxx 累計數據（state.stats）
  achievements: [
    { id: 'realm1', name: '初入仙途', desc: '斬殺練氣期十層妖王', type: 'highest', target: 10, reward: { stones: 5 } },
    { id: 'realm2', name: '築基有成', desc: '斬殺築基期十層妖王', type: 'highest', target: 20, reward: { stones: 10 } },
    { id: 'realm3', name: '金丹大道', desc: '斬殺結丹期十層妖王', type: 'highest', target: 30, reward: { stones: 15, eggs: 1 } },
    { id: 'realm5', name: '化神之境', desc: '斬殺化神期十層妖王', type: 'highest', target: 50, reward: { stones: 25, eggs: 2 } },
    { id: 'realm10', name: '羽化登仙', desc: '斬殺真仙境十層妖王', type: 'highest', target: 100, reward: { stones: 100, eggs: 5 } },
    { id: 'open100', name: '小試爐火', desc: '累計煉出 100 件法寶', type: 'stat:opened', target: 100, reward: { keys: 30 } },
    { id: 'open1000', name: '煉器師', desc: '累計煉出 1000 件法寶', type: 'stat:opened', target: 1000, reward: { stones: 10, iron: 5 } },
    { id: 'open5000', name: '煉器宗師', desc: '累計煉出 5000 件法寶', type: 'stat:opened', target: 5000, reward: { stones: 30, iron: 15 } },
    { id: 'mythic1', name: '仙器現世', desc: '煉出第一件仙品法寶', type: 'stat:mythics', target: 1, reward: { stones: 20 } },
    { id: 'codex30', name: '博聞強識', desc: '圖鑑收集 30 種法寶', type: 'codex', target: 30, reward: { stones: 10 } },
    { id: 'codex100', name: '藏寶閣主', desc: '圖鑑收集 100 種法寶', type: 'codex', target: 100, reward: { stones: 30, eggs: 2 } },
    { id: 'chest10', name: '爐火純青', desc: '煉器爐提升到十階', type: 'chest', target: 10, reward: { stones: 15 } },
    { id: 'chest20', name: '神爐圓滿', desc: '煉器爐提升到二十階', type: 'chest', target: 20, reward: { stones: 50 } },
    { id: 'tower10', name: '初登鎮妖塔', desc: '鎮妖塔通過第 10 層', type: 'tower', target: 10, reward: { stones: 5, iron: 2 } },
    { id: 'tower50', name: '塔頂望月', desc: '鎮妖塔通過第 50 層', type: 'tower', target: 50, reward: { stones: 30, iron: 10 } },
    { id: 'tower100', name: '百層鎮妖', desc: '鎮妖塔通過第 100 層', type: 'tower', target: 100, reward: { stones: 50 } },
    { id: 'tower150', name: '塔通天外', desc: '鎮妖塔通過第 150 層', type: 'tower', target: 150, reward: { stones: 100, iron: 20 } },
    // v1.1 V1 長期目標（2026-11-22 使用者確認，PLAN.md 2.28 第 9 段）：獎勵只有仙玉與外觀（不加戰力）
    { id: 'tower160', name: '鎮妖登峰', desc: '鎮妖塔通過第 160 層', type: 'tower', target: 160, reward: { stones: 300, cosmetic: 'zhenyao' } },
    // 飛升與挑戰型成就（B2；finalTier = 打倒最終 Boss 的最高天劫層數、codexDivine = 神品圖鑑收集數）
    { id: 'asc1', name: '白日飛升', desc: '第一次飛升', type: 'stat:ascensions', target: 1, reward: { stones: 20 } },
    { id: 'asc5', name: '五度登仙', desc: '累計飛升 5 次', type: 'stat:ascensions', target: 5, reward: { stones: 50, eggs: 3 } },
    { id: 'asc10', name: '十轉仙途', desc: '累計飛升 10 次', type: 'stat:ascensions', target: 10, reward: { stones: 100, iron: 20 } },
    { id: 'asc25', name: '廿五登仙', desc: '累計飛升 25 次', type: 'stat:ascensions', target: 25, reward: { stones: 250 } }, // v1.1 V1
    { id: 'asc30', name: '萬劫不磨', desc: '累計飛升 30 次', type: 'stat:ascensions', target: 30, reward: { stones: 300, eggs: 10 } },
    { id: 'tier5', name: '五重天劫', desc: '在天劫 5 重以上打倒最終 Boss', type: 'finalTier', target: 5, reward: { stones: 80 }, challenge: true },
    { id: 'tier10', name: '十重天劫', desc: '在天劫 10 重以上打倒最終 Boss', type: 'finalTier', target: 10, reward: { stones: 200, iron: 30 }, challenge: true },
    { id: 'tier15', name: '十五重天劫', desc: '在天劫 15 重以上打倒最終 Boss', type: 'finalTier', target: 15, reward: { stones: 300 }, challenge: true }, // v1.1 V1
    { id: 'tier20', name: '二十重天劫', desc: '在天劫 20 重以上打倒最終 Boss', type: 'finalTier', target: 20, reward: { stones: 500 }, challenge: true }, // v1.1 V1
    { id: 'noLower', name: '一往無前', desc: '天劫 1 重以上、本輪沒有降過層數就打倒最終 Boss', type: 'stat:noLowerFinal', target: 1, reward: { stones: 50 }, challenge: true },
    // 挑戰型成就（D3，2026-11-20 使用者確認，PLAN.md 2.27 第 4 段）：challenge = 成就頁的「挑戰」標籤
    //   final：打倒主線最終 Boss 的那一場符合條件時，stats[type 的 stat 名稱] +1（progress.js 的 recordFinalBossWin）
    //     minTier 這一場的天劫層數下限、flawless 沒受到任何傷害、lastStand 護命觸發過、maxFury 開戰時戰意層數上限、noBeast 沒有靈獸上陣、minTime 戰鬥秒數下限
    //   使用者規則：模擬中 30 天自然達成率超過 50% 的，天劫門檻往上調到低於 50%（調整紀錄見 PLAN.md 2.27 第 10 段）
    //   2026-11-20 使用者決定（PR #5 審閱）：毫髮無傷、首戰告捷改條件（不再只調天劫）；絕處逢生回到 3 重、改成一般成就
    //     firstRun：這一輪第一次通過第 100 關（而且 maxFury 0 = 沒輸過）；aboveBest：天劫 ≥ 之前打倒最終 Boss 的最高天劫 + aboveBest
    { id: 'flawless', name: '毫髮無傷', desc: '天劫 {tier} 重以上，戰鬥 {time} 秒以上而且完全沒受傷，打倒最終 Boss', type: 'stat:flawlessFinal', target: 1, reward: { stones: 80 }, challenge: true, final: { minTier: 5, flawless: true, minTime: 5 } },
    { id: 'lastStand', name: '絕處逢生', desc: '天劫 {tier} 重以上，護命觸發後仍打倒最終 Boss', type: 'stat:lastStandFinal', target: 1, reward: { stones: 60 }, final: { minTier: 3, lastStand: true } },
    { id: 'firstTry', name: '首戰告捷', desc: '這一輪第一次挑戰，就打倒天劫比之前最高紀錄高 {above} 重以上的最終 Boss', type: 'stat:firstTryFinal', target: 1, reward: { stones: 80 }, challenge: true, final: { firstRun: true, maxFury: 0, aboveBest: 2 } },
    { id: 'lonewolf', name: '孤身斬魔', desc: '天劫 {tier} 重以上，沒有靈獸上陣就打倒最終 Boss', type: 'stat:lonewolfFinal', target: 1, reward: { stones: 80 }, challenge: true, final: { minTier: 3, noBeast: true } },
    { id: 'longFight', name: '鏖戰', desc: '天劫 {tier} 重以上，戰鬥 15 秒以上才打倒最終 Boss', type: 'stat:longFinal', target: 1, reward: { stones: 60 }, challenge: true, final: { minTier: 3, minTime: 15 } },
    { id: 'threeDao', name: '三道歸一', desc: '用劍修、法修、體修各打倒一次最終 Boss（天劫不限）', type: 'daoFinals', target: 3, reward: { stones: 150, iron: 20 }, challenge: true },
    //   open：一次開爐（含自動開爐的一批）開出 divines 件以上神品時，stats[type 的 stat 名稱] +1（chest.js 的 processOpenedItems）
    //   2026-11-20 使用者決定（PR #5 審閱）：原本「2 件以上仙品或神品」第 0 天就 100% 自然達成，改成 2 件神品
    { id: 'twinDivine', name: '雙神同爐', desc: '一次開爐開出 {count} 件以上神品', type: 'stat:twinDivine', target: 1, reward: { stones: 50 }, open: { divines: 2 } },
    { id: 'divine1', name: '神器出世', desc: '煉出第一件神品法寶', type: 'stat:divines', target: 1, reward: { stones: 50 } },
    { id: 'chest25', name: '神爐再鑄', desc: '煉器爐提升到二十五階', type: 'chest', target: 25, reward: { stones: 80 } },
    { id: 'chest30', name: '鴻鈞神爐', desc: '煉器爐提升到三十階', type: 'chest', target: 30, reward: { stones: 150 } },
    // v1.1 V1：圖鑑全收集（兌換來的外觀也算）
    { id: 'codexAll', name: '萬寶歸宗', desc: '圖鑑收集全部 198 種法寶（含兌換）', type: 'codex', target: 198, reward: { stones: 100, cosmetic: 'wanbao' } },
    { id: 'codexDivine', name: '神品圖譜', desc: '圖鑑收集全部 6 件神品專屬', type: 'codexDivine', target: 6, reward: { stones: 100 } },
    { id: 'hatch10', name: '靈獸之友', desc: '累計孵化 10 顆靈獸蛋', type: 'stat:hatched', target: 10, reward: { eggs: 1 } },
    // 靈獸覺醒（B3）：beastsAwakened = 已覺醒的靈獸種類數
    { id: 'awaken1', name: '靈獸覺醒', desc: '第一次覺醒靈獸', type: 'beastsAwakened', target: 1, reward: { stones: 30 } },
    { id: 'awaken5', name: '五靈齊醒', desc: '覺醒 5 種靈獸', type: 'beastsAwakened', target: 5, reward: { stones: 80, eggs: 3 } },
    { id: 'beasts6', name: '百獸之主', desc: '六種靈獸全部結緣', type: 'beastsOwned', target: 6, reward: { stones: 50 } },
    { id: 'enhance10', name: '千錘百鍊', desc: '任一部位強化到 +10', type: 'enhanceMax', target: 10, reward: { iron: 5 } },
    { id: 'enhance15', name: '神兵天成', desc: '任一部位強化到 +15', type: 'enhanceMax', target: 15, reward: { stones: 30 } },
    { id: 'dao', name: '擇道而行', desc: '選擇一條道途', type: 'daoChosen', target: 1, reward: { stones: 5 } },
    { id: 'dao2', name: '二轉大成', desc: '道途突破二轉', type: 'daoTier', target: 2, reward: { stones: 20 } },
    { id: 'boss50', name: '斬妖除魔', desc: '累計擊敗 50 隻妖王', type: 'stat:bossKills', target: 50, reward: { stones: 10 } },
    { id: 'kill10k', name: '萬妖辟易', desc: '累計擊敗 10000 隻妖獸', type: 'stat:kills', target: 10000, reward: { stones: 20, keys: 100 } },
    { id: 'login7', name: '持之以恆', desc: '累計簽到 7 天', type: 'stat:loginDays', target: 7, reward: { stones: 20, eggs: 1 } },
  ],

  // ---------- 月曆簽到（6-5；每天簽一次，30 格一輪） ----------
  // 第 N 次簽到領第 ((N − 1) mod 30) + 1 格，中斷不歸零；每 7 天一個大獎（第 7、14、21、28 格）。
  // 不放法寶、不放新手七日禮的「爐火符 50」包。外觀已擁有（第二輪以後）時改發 ownedCosmeticBonus。
  signin: {
    days: [
      { keys: 40 },
      { gold: 3000, iron: 2 },
      { eggs: 1 },
      { essence: 15 },
      { keys: 70, iron: 3 },
      { essence: 20, gold: 2000 },
      { stones: 60 }, // 第 7 格大獎：仙玉
      { gold: 4000 },
      { iron: 3 },
      { keys: 60 },
      { essence: 15 },
      { eggs: 1 },
      { gold: 4000, iron: 2 },
      { iron: 15, essence: 10 }, // 第 14 格大獎：強化材料
      { keys: 70 },
      { essence: 20 },
      { iron: 3 },
      { gold: 5000 },
      { eggs: 1 },
      { keys: 70, iron: 2 },
      { eggs: 5, essence: 10 }, // 第 21 格大獎：靈獸蛋
      { gold: 6000 },
      { iron: 4 },
      { essence: 20 },
      { keys: 80 },
      { eggs: 1 },
      { iron: 3, gold: 4000 },
      { cosmetic: 'yuehua', stones: 30 }, // 第 28 格大獎：限定外觀
      { keys: 80 },
      { essence: 25, eggs: 1 },
    ],
    bigDays: [7, 14, 21, 28], // 大獎格（畫面標示用）
    ownedCosmeticBonus: { stones: 20 },
  },

  // ---------- 商店與儲值 ----------
  shop: {
    // 坊市：用靈石購買，每天 00:00 刷新 6 個商品；可花仙玉手動刷新
    // 商品名稱裡的 {keys}、{iron} 等會換成放大後的獎勵數量（scale.js）
    market: {
      slots: 6,
      refreshCost: [5, 10, 15, 20], // 第 1、2、3、4 次以上手動刷新的仙玉
      priceScale: 0.2, // 價格 = price × (1 + 最高境界層數 × priceScale)
      pool: [
        { id: 'm_keys20', name: '爐火符 ×{keys}', icon: 'keys', weight: 20, price: 400, reward: { keys: 20 } },
        { id: 'm_keys50', name: '爐火符 ×{keys}', icon: 'keys', weight: 12, price: 950, reward: { keys: 50 } },
        { id: 'm_iron2', name: '玄鐵 ×{iron}', icon: 'iron', weight: 15, price: 800, reward: { iron: 2 } },
        { id: 'm_iron5', name: '玄鐵 ×{iron}', icon: 'iron', weight: 8, price: 1900, reward: { iron: 5 } },
        { id: 'm_egg', name: '靈獸蛋 ×1', icon: 'egg', weight: 10, price: 2500, reward: { eggs: 1 } },
        { id: 'm_essence', name: '靈獸精魄 ×{essence}', icon: 'essence', weight: 10, price: 1500, reward: { essence: 10 } },
        { id: 'm_stones', name: '仙玉 ×{stones}', icon: 'stones', weight: 5, price: 5000, reward: { stones: 3 } },
        { id: 'm_xuanbox', name: '玄品法寶匣', icon: 'furnace', weight: 10, price: 1200, reward: { loot: 'xuanBox' } },
      ],
    },
    // 仙玉商店
    gem: [
      { id: 'g_eggs5', name: '靈獸蛋 ×5', icon: 'egg', price: 50, reward: { eggs: 5 } },
      { id: 'g_iron10', name: '玄鐵 ×{iron}', icon: 'iron', price: 30, reward: { iron: 10 } },
      { id: 'g_keys200', name: '爐火符 ×{keys}', icon: 'keys', price: 40, reward: { keys: 200 } },
      { id: 'g_box', name: '仙緣寶匣', icon: 'seal', price: 60, reward: { loot: 'xianyuanBox' } },
      { id: 'g_double', name: '雙倍收益卡', desc: '24 小時內修煉擊殺與閉關的靈石 ×2（可疊加時間）', icon: 'star', price: 80, reward: { doubleHours: 24 } },
    ],
    doubleCardMult: 2, // 雙倍收益卡：修煉擊殺與閉關的靈石倍率
    orderLogMax: 30, // 保留幾筆模擬付款紀錄
    orderLogShown: 5, // 儲值頁顯示最近幾筆
    // 外觀（只改變主角的顏色與光暈，不影響數值）
    // price: null 代表不能用仙玉購買（例如累計儲值獎勵），source 說明取得方式
    cosmetics: {
      default: { name: '素衣', color: null, aura: null, price: 0 },
      qingshan: { name: '青衫俠客', color: '#2c5d8f', aura: '#8ec3ff', price: 200 },
      zipao: { name: '紫袍雷尊', color: '#6b3f95', aura: '#c9a4f0', price: 200 },
      jinshen: { name: '金身羅漢', color: '#8a5a10', aura: '#f0c76e', price: 300 },
      zixia: { name: '紫霞仙尊', color: '#7a2f6b', aura: '#ff9ad5', price: null, source: '累計儲值獎勵' },
      hundun: { name: '混沌道袍', color: '#3b2f5c', aura: '#b59cff', price: null, source: '真仙境首殺（第 10 章）' },
      yuehua: { name: '月華仙衣', color: '#33506e', aura: '#dce9ff', price: null, source: '月曆簽到第 28 格' },
      jielei: { name: '劫雷仙衣', color: '#1f4f6b', aura: '#7fe3ff', price: null, source: '天劫 6 重打倒最終 Boss（飛升）' },
      // v1.1 V1（PLAN.md 2.28）
      zixiao: { name: '紫霄劫衣', color: '#4a2a7a', aura: '#d7b8ff', price: null, source: '天劫 18 重打倒最終 Boss（飛升）' },
      taixu: { name: '太虛道袍', color: '#1d2e45', aura: '#9ff0ff', price: null, source: '天劫 24 重打倒最終 Boss（飛升）' },
      wanbao: { name: '萬寶霞衣', color: '#7a4a1a', aura: '#ffd98a', price: null, source: '成就「萬寶歸宗」（圖鑑全收集）' },
      zhenyao: { name: '鎮妖玄袍', color: '#2b3a2a', aura: '#a8f0a0', price: null, source: '成就「鎮妖登峰」（鎮妖塔第 160 層）' },
    },
    // 儲值（模擬版；價格單位為新台幣）
    recharge: {
      currency: 'NT$',
      // 仙玉方案：實得 = gems（基本）+ bonus（贈送）；越高檔贈送比例越高
      gems: [
        { id: 'r_30', price: 30, gems: 60, bonus: 30 }, // 贈送 50%
        { id: 'r_150', price: 150, gems: 300, bonus: 240 }, // 贈送 80%
        { id: 'r_450', price: 450, gems: 900, bonus: 900 }, // 贈送 100%
        { id: 'r_990', price: 990, gems: 1980, bonus: 2970 }, // 贈送 150%
      ],
      firstDouble: true, // 每個方案第一次購買，實得仙玉加倍
      firstMult: 2, // 首儲倍率
      // 首儲專屬：第一次購買任何仙玉方案時加送（只有一次）
      firstExclusive: { name: '首儲專屬：天品靈獸', reward: { loot: 'firstBeast' } },
      // 月卡：購買當下送 instant，之後 days 天每天第一次上線自動發放 daily；到期前 remindDays 天提醒
      monthCard: { id: 'r_month', name: '月卡', price: 90, instant: 300, daily: 100, days: 30, remindDays: 3 },
      starter: { id: 'r_starter', name: '新手禮包', price: 30, limit: 1,
        reward: { stones: 300, keys: 300, eggs: 5, iron: 10, loot: 'starterRandom' } },
      // 修仙戰令：賽季制，進度用戰令經驗（見 CONFIG.pass）
      pass: { id: 'r_pass', name: '修仙戰令', price: 150 },
      // 累計儲值獎勵：累計金額（NT$）達到 amount 可領；只計算儲值頁的真錢商品
      spendRewards: [
        { amount: 30, reward: { eggs: 3, iron: 10 } },
        { amount: 150, reward: { stones: 200, items: [{ rarity: 4 }] } },
        { amount: 450, reward: { items: [{ rarity: 5 }], eggs: 10 } },
        { amount: 990, reward: { loot: 'xianBeast', stones: 500 } },
        { amount: 2000, reward: { cosmetic: 'zixia', stones: 1000, iron: 50 } },
      ],
    },
  },

  // ---------- 修仙戰令（賽季） ----------
  // 每 seasonDays 天一季（從 seasonEpoch 那天起算，本地時間）。季末：未領取但已達成的獎勵自動寄到信箱，進度歸零、付費線需重新解鎖。
  // 戰令經驗：開爐每件 perItemOpened、修煉擊殺每隻 perKill、領取每日任務每個 perDailyTask、每週任務每個 perWeeklyTask、每天第一次上線 perLogin
  pass: {
    seasonDays: 30,
    seasonEpoch: '2026-11-01',
    expPerTier: 500, // 每升一級需要的經驗（共 tiers.length 級）
    exp: { perItemOpened: 0.05, perKill: 0.02, perDailyTask: 40, perWeeklyTask: 300, perLogin: 50 },
    // 免費線包含主要養成資源（爐火符、玄鐵、靈獸蛋、精魄、仙玉、法寶）；付費線約為免費線的三倍以上
    tiers: [
      { free: { keys: 30 }, premium: { stones: 60, keys: 100 } },
      { free: { iron: 3 }, premium: { iron: 8 } },
      { free: { eggs: 1 }, premium: { eggs: 3 } },
      { free: { essence: 15 }, premium: { essence: 40, iron: 4 } },
      { free: { stones: 20 }, premium: { stones: 100 } },
      { free: { keys: 30 }, premium: { stones: 60, keys: 100 } },
      { free: { iron: 3 }, premium: { iron: 8 } },
      { free: { eggs: 1 }, premium: { eggs: 3 } },
      { free: { essence: 15 }, premium: { essence: 40, iron: 4 } },
      { free: { items: [{ rarity: 3 }], stones: 20 }, premium: { items: [{ rarity: 4 }], eggs: 3 } },
      { free: { keys: 40 }, premium: { stones: 60, keys: 100 } },
      { free: { iron: 4 }, premium: { iron: 10 } },
      { free: { eggs: 1 }, premium: { eggs: 3 } },
      { free: { essence: 20 }, premium: { essence: 50, iron: 5 } },
      { free: { stones: 30 }, premium: { stones: 120 } },
      { free: { keys: 40 }, premium: { stones: 60, keys: 120 } },
      { free: { iron: 4 }, premium: { iron: 10 } },
      { free: { eggs: 2 }, premium: { eggs: 4 } },
      { free: { essence: 20 }, premium: { essence: 50, iron: 5 } },
      { free: { items: [{ rarity: 4 }] }, premium: { items: [{ rarity: 5 }] } },
      { free: { keys: 50 }, premium: { stones: 80, keys: 150 } },
      { free: { iron: 5 }, premium: { iron: 12 } },
      { free: { eggs: 2 }, premium: { eggs: 5 } },
      { free: { essence: 25 }, premium: { essence: 60, iron: 6 } },
      { free: { stones: 40 }, premium: { stones: 150 } },
      { free: { keys: 50 }, premium: { stones: 80, keys: 150 } },
      { free: { iron: 5 }, premium: { iron: 12 } },
      { free: { eggs: 2 }, premium: { eggs: 5 } },
      { free: { essence: 25 }, premium: { essence: 60, iron: 6 } },
      { free: { items: [{ rarity: 4 }], stones: 50 }, premium: { items: [{ rarity: 5 }], stones: 300 } },
    ],
  },

  // ---------- 福利（免費） ----------
  welfare: {
    dailyLoginGems: 20, // 每天第一次上線自動發放的仙玉
    // 新手七日禮：前 7 個「有上線的日子」各自動發放一份（錯過的日子不會遺失，下次上線領下一份）
    newbieGifts: [
      { keys: 50, gold: 2000 },
      { keys: 50, eggs: 1 },
      { keys: 50, iron: 3 },
      { keys: 50, stones: 30 },
      { keys: 50, essence: 20 },
      { keys: 50, eggs: 2, iron: 3 },
      { keys: 50, items: [{ rarity: 4 }] }, // 第 7 天：天品法寶
    ],
    mailKeepDays: 0, // 信箱信件保留天數（0 = 永久保留直到領取）
  },

  // ---------- 付費商品價值換算（顯示「價值 X 倍」） ----------
  // 價值 X 倍 = 內容總價值（換算成仙玉）× ntdPerGem ÷ 售價
  //   ntdPerGem：每顆仙玉的基準價格，以最小儲值檔「NT$30 = 60 仙玉（不含贈送）」為準
  //   隨機內容（loot）以期望值計算；法寶依品階（序號 0～6）、靈獸依品階（0～5）換算
  valuation: {
    ntdPerGem: 0.5,
    gemValue: {
      stones: 1,
      keys: 0.2, // 仙玉商店：200 張 = 40 仙玉
      iron: 3, // 仙玉商店：10 個 = 30 仙玉
      eggs: 10, // 仙玉商店：5 顆 = 50 仙玉
      essence: 1,
      gold: 0.002,
      doubleHours: 3.3, // 雙倍收益卡：24 小時 = 80 仙玉
      cosmetic: 300,
      items: [0.5, 1, 3, 10, 40, 150, 500], // 各品階法寶一件（神品 500：B2）
      beast: [2, 4, 8, 16, 60, 200], // 各品階靈獸一隻
    },
  },

  // ---------- 裝備名稱表 ----------
  // 名稱 = 品質名稱 + "・" + 前綴 + "之" + 部位名詞
  names: {
    prefixes: ['青霜', '紫電', '赤霄', '玄冰', '太虛', '九幽', '星河', '碧落', '流雲', '焚天', '鎮岳', '天機'],
    nouns: {
      weapon: ['飛劍', '劍', '劍丸'],
      helmet: ['道冠', '玉冠', '蓮花冠'],
      armor: ['道袍', '法衣', '羽衣'],
      gloves: ['護腕', '臂環', '腕甲'],
      boots: ['雲履', '步雲靴', '踏風履'],
      accessory: ['玉佩', '靈珠', '玉環'],
    },
  },

  // ---------- 計時器 ----------
  timing: {
    backgroundTickMs: 1000, // 分頁在背景時（requestAnimationFrame 停止）推進戰鬥的間隔
    dailyCheckMs: 30000, // 檢查是否跨過午夜（每日重置）的間隔
    slowTickMs: 1000, // 成就檢查、背景音樂切換的間隔
  },

  // ---------- 飛升（路線圖 B1，PLAN.md 2.22；存檔 v12） ----------
  // 本輪最高關卡 ≥ gate 才能飛升；飛升後主線關卡從頭再爬，靈石與爐火符保留 keepRatio，其他全部保留。
  // 仙元 = 〔(本輪最高關卡 − pointsFrom)^pointsExp × pointsBase ＋ 本輪打倒最終 Boss 時 finalBonus〕× (1 + pointsPerTier × 天劫層數)，無條件捨去
  //   天劫層數：本輪中途降過層的話，用本輪用過的最低層數
  // 天劫：飛升時選下一輪的層數 T（0 ～ 上限）；那一輪主線妖獸（含 Boss）氣血 × hpMult^T、攻擊 × atkMult^T（不影響秘境、鎮妖塔、上古妖王）
  //   上限 = 曾經在某一層「本輪通過第 gate 關」的最高層數 + aboveCleared；本輪中途只能降層、不能升層
  // 冷卻：距離上次飛升 cooldownHours 小時（真實時間）才能再飛升；第一次飛升沒有冷卻
  ascension: {
    gate: 90,
    pointsFrom: 80,
    pointsExp: 1.5,
    pointsBase: 1,
    finalBonus: 100,
    keepRatio: 0.1,
    cooldownHours: 48,
    // 2026-11-20 使用者決定（D1 方案 Z2，PLAN.md 2.27）：攻擊倍率 1.3 → 1.23（氣血維持 1.3）。
    //   劍修、法修的實力天劫不變；體修的護體在 Boss 不再一擊秒殺時有用，第 28 天從比劍修少 0.8 層變成多約 0.3 層
    tribulation: { hpMult: 1.3, atkMult: 1.23, pointsPerTier: 0.3, aboveCleared: 1 },
    // 飛升天賦：每級花費 = round(cost × costGrowth^目前等級)；max 省略 = 沒有上限
    //   kind：stat 屬性、resource 資源、convenience 便利
    //   atk／hp：攻擊／氣血 × (1 + per × 等級)，與其他加成相乘
    //   boss：主線 Boss 受到的傷害 × (1 + per × 等級)（battle.js 的 getDmgTakenMult；Boss 氣血不變）
    //   income：爐火符收入（主線、閉關、妖獸潮，即 scaleKeyIncome）與玄鐵收入（ironIncomeSources 列的來源、上古妖王）× (1 + per × 等級)
    //   offline：閉關上限 + per × 等級 小時；start：飛升後從第 1 + per × 等級 關開始（最多 startMax）
    //   chestSpeed：自動開爐間隔 × (1 − per × 等級)
    //   hp 的護命：受到致命傷害時有 survivePer × 等級 的機率（最多 surviveMax）保留 1 點氣血，每場戰鬥一次（battle.js 的 tryHeroSurvive）
    //   income 的 goldPer：修煉靈石（主線擊殺，閉關跟著上線收益）× (1 + goldPer × 等級)
    // 2026-11-17 使用者決定：誅魔 +15%／級（原 +6%）、聚寶改成爐火符與玄鐵（原靈石與爐火符）
    // 2026-11-18 使用者決定（PR #2 審閱）：劍心花費成長 1.25 → 1.40、聚寶加回修煉靈石 +5%／級
    // 2026-11-19 使用者決定（PR #2 審閱）：玄體加「護命」方案 X（+3%／級，最多 60%）
    talents: [
      { id: 'atk', name: '劍心', kind: 'stat', per: 0.08, cost: 20, costGrowth: 1.4, desc: '攻擊 +{v}%（與其他加成相乘）' },
      { id: 'hp', name: '玄體', kind: 'stat', per: 0.08, survivePer: 0.03, surviveMax: 0.6, cost: 20, costGrowth: 1.25, desc: '氣血 +{v}%（與其他加成相乘）、護命 {r}%' },
      { id: 'boss', name: '誅魔', kind: 'stat', per: 0.15, cost: 25, costGrowth: 1.3, desc: '對主線 Boss 的傷害 +{v}%' },
      { id: 'income', name: '聚寶', kind: 'resource', per: 0.1, goldPer: 0.05, cost: 15, costGrowth: 1.25, desc: '爐火符與玄鐵收入 +{v}%、修煉靈石 +{g}%' },
      { id: 'offline', name: '洞府', kind: 'convenience', per: 2, max: 6, cost: 20, costGrowth: 1.5, desc: '閉關上限 +{v} 小時' },
      { id: 'start', name: '縮地', kind: 'convenience', per: 10, max: 8, cost: 15, costGrowth: 1.4, desc: '飛升後從第 {s} 關開始' },
      { id: 'chestSpeed', name: '爐火純青', kind: 'convenience', per: 0.1, max: 5, cost: 15, costGrowth: 1.4, desc: '自動開爐間隔 −{v}%' },
    ],
    startMax: 81,
    // 聚寶的玄鐵加成套用在哪些獎勵來源（grantRewards 的 source；儲值、仙玉商店、信件等不加）
    ironIncomeSources: ['towerSweep', 'daily', 'weekly', 'activity', 'autoClaim', 'achievement', 'codex', 'signin', 'pass', 'chapter', 'market', 'login', 'newbie'],
    // 第幾次飛升後開放（飛升頁「之後開放」的清單；實際條件在功能開放表 chestBeyond、beastAwaken、chestBeyond30）
    unlocks: { talents: 1, chestTier25: 2, beastAwaken: 3, chestTier30: 5 },
    previewSteps: [91, 95, 99, 100], // 飛升頁「再推到第 Y 關可得 Z」的目標關卡
    // 天劫里程碑（B2，使用者已確認 2026-11-18）：第一次在天劫 tier 層以上打倒最終 Boss 時發放一次（跳層時一起發）
    //   divinePick：神品法寶「6 個部位自選一件」（飛升頁選部位）
    tierMilestones: [
      { tier: 3, reward: { stones: 100 } },
      { tier: 6, reward: { stones: 200, cosmetic: 'jielei' } },
      { tier: 9, reward: { stones: 300 } },
      { tier: 12, reward: { stones: 400, divinePick: 1 } },
      { tier: 15, reward: { stones: 500 } },
      // v1.1 V1（2026-11-22 使用者確認，PLAN.md 2.28）：每 3 重 +100 仙玉；V3 完成後回頭檢查會不會太早達成
      { tier: 18, reward: { stones: 600, cosmetic: 'zixiao' } },
      { tier: 21, reward: { stones: 700 } },
      { tier: 24, reward: { stones: 800, cosmetic: 'taixu' } },
    ],
    // 第 at 次飛升（開放爐階 21～25）時送的神品（部位隨機；PR #2 審閱後使用者決定 2026-11-18）。v13 以前已飛升 at 次以上的存檔，遷移時寄到信箱補發
    divineGift: { at: 2, reward: { items: [{ rarity: 6 }] } },
    backupKey: 'chestIdleRPG_save_ascend_backup', // 飛升前自動備份（設定頁可以還原）
    historyMax: 30, // 飛升紀錄最多保留幾筆
  },

  // ---------- 測試用（開發者按鈕） ----------
  dev: {
    enabled: false, // 設為 true 會在設定頁顯示「開發者選項」
    offlineMinutes: 120, // 「模擬離線」按鈕一次加的分鐘數
    addKeys: 10,
    addGold: 10000,
    addStages: 10,
    addStones: 5,
  },
};
