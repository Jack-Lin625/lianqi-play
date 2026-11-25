// @ts-check
/* =========================================================
 * icons.js — 水墨風格 inline SVG 圖示
 *
 * 所有圖示定義成一組 <symbol>，開頁時插入頁面一次，之後用 icon('名稱') 取得標記。
 * 線條顏色跟著文字顏色（currentColor）：放在宣紙上是墨色，放在深色底上是金色。
 * 點綴色用 CSS 變數：--ico-red（硃砂）、--ico-jade（玉色）、--ico-paper（符紙）。
 * ========================================================= */

/** 套用水墨筆觸的共用屬性：外框線 + 淡墨渲染 */
const INK = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const WASH = 'fill="currentColor" stroke="none" opacity="0.16"';
const RED = 'style="fill:var(--ico-red,#a8322a)" stroke="none"';
const JADE = 'style="fill:var(--ico-jade,#4f8a6a)" stroke="none"';
const PAPER = 'style="fill:var(--ico-paper,#e8d59c)"';

/** 圖示內容（viewBox 0 0 48 48） */
const ICON_PATHS = {
  // ---- 資源 ----
  gold: `<path ${JADE} opacity="0.45" d="M24 5 36 17 30 42H18L12 17Z"/>
    <path ${INK} d="M24 5 36 17 30 42H18L12 17Z M12 17H36 M24 5 20 17 24 42 28 17Z"/>`,
  keys: `<path ${PAPER} stroke="currentColor" stroke-width="2.4" d="M14 4H34V44H14Z"/>
    <path ${RED} d="M24 37C17 31 21 24 24 17 27 24 31 30 24 37Z"/>
    <path ${INK} stroke-width="2" d="M18 9H30 M18 12H30 M20 41H28"/>`,
  stones: `<circle cx="24" cy="24" r="17" ${JADE} opacity="0.5"/>
    <circle cx="24" cy="24" r="17" ${INK}/><circle cx="24" cy="24" r="5.5" ${INK}/>
    <path ${INK} stroke-width="1.8" d="M12 18c3-3 6 0 4 2 M32 32c3 3 6 0 4-2"/>`,

  // ---- 煉器爐（鼎） ----
  furnace: `<path ${WASH} d="M9 20H39C39 31 33 37 24 37 15 37 9 31 9 20Z"/>
    <path ${INK} d="M7 20H41 M9 20C9 31 15 37 24 37 33 37 39 31 39 20 M13 20V12H18V20 M30 20V12H35V20 M15 35 11 44 M24 37V44 M33 35 37 44"/>
    <path ${INK} stroke-width="2" d="M14 27c3-3 5 3 8 0s5 3 8 0 5 3 6 0"/>`,

  // ---- 法寶部位 ----
  sword: `<path ${WASH} d="M10 37 36 10 40 8 38 12 12 39Z"/>
    <path ${INK} d="M10 37 36 10 40 8 38 12 12 39Z M11 30 18 37 M10 38 5 43"/>
    <path ${RED} d="M5 43c-3 3-1 5 1 4s2-4-1-4Z"/>`,
  crown: `<path ${WASH} d="M12 34Q24 40 36 34L34 26 28 30 24 18 20 30 14 26Z"/>
    <path ${INK} d="M12 34Q24 40 36 34 M12 34 14 26 20 30 24 18 28 30 34 26 36 34 M5 27 43 22"/>
    <circle cx="24" cy="31" r="2.5" ${RED}/>`,
  robe: `<path ${WASH} d="M24 8 15 10 4 22 10 29 14 25V43H34V25L38 29 44 22 33 10Z"/>
    <path ${INK} d="M24 8 15 10 4 22 10 29 14 25V43H34V25L38 29 44 22 33 10Z M19 9 24 23 29 9 M14 27H34"/>`,
  bracer: `<path ${WASH} d="M14 12H34V36H14Z"/>
    <path ${INK} d="M14 12H34V36H14Z M14 18H34 M14 30H34"/>
    <path ${INK} stroke-width="2" d="M19 24c0-3 4-3 4 0s4 3 4 0"/>`,
  shoe: `<path ${WASH} d="M6 36C6 27 13 25 20 27L31 31C37 33 42 33 42 38H6Z"/>
    <path ${INK} d="M6 38C6 27 13 25 20 27L31 31C37 33 42 33 42 38Z M36 32c3-5 9-2 5 2"/>`,
  pendant: `<circle cx="24" cy="20" r="11" ${JADE} opacity="0.5"/>
    <circle cx="24" cy="20" r="11" ${INK}/><circle cx="24" cy="20" r="4" ${INK}/>
    <path ${INK} d="M24 3V9 M24 31V36"/><path ${RED} d="M21 36H27L25 46H23Z"/>`,

  // ---- 分頁 ----
  lotus: `<path ${WASH} d="M24 10C18 18 18 28 24 36 30 28 30 18 24 10Z"/>
    <path ${INK} d="M24 10C18 18 18 28 24 36 30 28 30 18 24 10Z M24 36C16 36 8 30 7 21 14 22 20 28 24 36Z M24 36C32 36 40 30 41 21 34 22 28 28 24 36Z M10 41H38"/>`,
  mountain: `<path ${WASH} d="M3 39 15 18 22 27 31 12 45 39Z"/>
    <path ${INK} d="M3 39 15 18 22 27 31 12 45 39 M8 33c5-2 9 2 14 0s9-2 14 0"/>`,
  scroll: `<path ${PAPER} stroke="none" d="M12 10H36V38H12Z"/>
    <path ${INK} d="M12 10H36V38H12Z M8 8H40 M8 40H40 M17 17H31 M17 23H31 M17 29H26"/>`,

  taiji: `<circle cx="24" cy="24" r="19" ${INK}/>
    <path fill="currentColor" opacity="0.85" d="M24 5A19 19 0 0 1 24 43 9.5 9.5 0 0 1 24 24 9.5 9.5 0 0 0 24 5Z"/>
    <circle cx="24" cy="14.5" r="3" fill="currentColor"/><circle cx="24" cy="33.5" r="3" ${RED}/>`,

  // ---- 靈獸 ----
  'b-fox': `<path ${WASH} d="M6 10 16 18H28L38 10 37 26 22 38 8 26Z"/>
    <path ${INK} d="M6 10 16 18H28L38 10 37 26 22 38 8 26Z M17 26h3 M27 26h-3 M20 33h4"/>
    <path ${INK} d="M37 30C44 30 47 38 42 44 40 40 37 38 33 38"/><path ${RED} d="M42 44c2-3 1-6-1-8 0 3-1 5 1 8Z"/>`,
  'b-turtle': `<path ${JADE} opacity="0.45" d="M8 30C8 18 16 12 24 12S40 18 40 30Z"/>
    <path ${INK} d="M8 30C8 18 16 12 24 12S40 18 40 30Z M4 30H44 M24 12V30 M14 18 18 30 M34 18 30 30 M12 30 10 37 M36 30 38 37"/>
    <path ${INK} d="M40 24C44 22 47 24 46 27 44 29 42 28 40 27"/>`,
  'b-bird': `<path ${WASH} d="M14 26C14 18 20 14 26 16L34 12 32 20C34 28 28 34 20 34Z"/>
    <path ${INK} d="M14 26C14 18 20 14 26 16L34 12 32 20C34 28 28 34 20 34 16 34 14 30 14 26Z M20 34 14 44 M24 33 22 44 M26 18 40 6 M30 22 46 16"/>
    <path ${RED} d="M34 12 40 10 36 15Z M14 44c-2-3 0-6 2-6 0 2 0 4-2 6Z"/><circle cx="25" cy="20" r="1.4" fill="currentColor"/>`,
  'b-marten': `<path ${WASH} d="M6 30C10 22 20 20 30 22 36 23 40 20 42 16L44 22C42 28 36 32 28 32 18 32 12 34 6 30Z"/>
    <path ${INK} d="M6 30C10 22 20 20 30 22 36 23 40 20 42 16L44 22C42 28 36 32 28 32 18 32 12 34 6 30Z M10 31 8 38 M18 32 18 39 M28 32 30 38 M42 16 40 11 M44 18 46 14"/>
    <path style="fill:var(--ico-gold,#c9a14a)" stroke="none" d="M20 6 14 18H19L16 26 26 12H21L24 6Z"/>`,
  'b-crane': `<path ${WASH} d="M16 22C16 16 22 14 28 16 34 18 36 24 32 28 26 32 18 30 16 22Z"/>
    <path ${INK} d="M16 22C16 16 22 14 28 16 34 18 36 24 32 28 26 32 18 30 16 22Z M28 16C28 10 30 6 34 5 M34 5 42 8 M22 30 20 44 M26 30 28 44 M16 22 4 18 M18 26 6 28"/>
    <circle cx="34" cy="5" r="2.2" ${RED}/>`,
  'b-qilin': `<path ${WASH} d="M10 34C10 24 16 18 26 18H34L40 12 42 22 36 26V34Z"/>
    <path ${INK} d="M10 34C10 24 16 18 26 18H34L40 12 42 22 36 26V34 M12 34 10 44 M18 34 18 44 M30 34 30 44 M36 34 37 44 M40 12 38 4 M42 14 46 8 M10 30C4 28 4 22 8 20"/>
    <path ${RED} d="M18 18c2-6 6-6 6-2 2-4 6-3 5 2Z"/><circle cx="38" cy="18" r="1.4" fill="currentColor"/>`,
  egg: `<path ${PAPER} stroke="none" d="M24 5C15 5 10 19 10 28 10 37 16 43 24 43S38 37 38 28C38 19 33 5 24 5Z"/>
    <path ${INK} d="M24 5C15 5 10 19 10 28 10 37 16 43 24 43S38 37 38 28C38 19 33 5 24 5Z"/>
    <path ${RED} opacity="0.75" d="M17 22c3-2 6 2 9 0s5-2 6 0c-1 3-4 4-7 3s-6 0-8-3Z"/><path ${JADE} opacity="0.6" d="M15 32c4-2 7 1 10-1s6-1 8 1c-2 3-6 4-9 3s-6 0-9-3Z"/>`,
  essence: `<path ${WASH} d="M24 4C30 14 38 20 38 29 38 37 32 44 24 44S10 37 10 29C10 20 18 14 24 4Z"/>
    <path ${INK} d="M24 4C30 14 38 20 38 29 38 37 32 44 24 44S10 37 10 29C10 20 18 14 24 4Z"/>
    <path ${JADE} opacity="0.7" d="M24 18c4 6 7 9 7 13s-3 7-7 7-7-3-7-7 3-7 7-13Z"/>`,
  // 神髓（v1.1 V2，神品煉化材料）：菱形晶石，中間一點硃砂
  marrow: `<path ${WASH} d="M24 4 38 20 24 44 10 20Z"/>
    <path ${INK} d="M24 4 38 20 24 44 10 20Z M10 20H38 M24 4 18 20 24 44 30 20Z"/>
    <path ${RED} opacity="0.8" d="M24 14c3 3 4 5 4 7s-2 4-4 4-4-2-4-4 1-4 4-7Z"/>`,
  meditate: `<circle cx="24" cy="22" r="20" style="fill:var(--ico-gold,#e0c389)" opacity="0.18"/>
    <circle cx="24" cy="12" r="4.5" fill="currentColor"/><circle cx="24" cy="6" r="2" fill="currentColor"/>
    <path fill="currentColor" d="M24 17C19 17 16 20 15 26L12 33C10 37 13 40 18 40H30C35 40 38 37 36 33L33 26C32 20 29 17 24 17Z"/>
    <path fill="currentColor" d="M6 42C10 37 18 36 24 38 30 36 38 37 42 42 36 45 12 45 6 42Z"/>
    <path ${INK} stroke-width="1.6" opacity="0.5" d="M38 8c-3-2 2-4-1-6 M42 14c-3-2 2-4-1-6"/>`,

  lantern: `<path ${RED} opacity="0.8" d="M14 14C14 10 34 10 34 14V34C34 38 14 38 14 34Z"/>
    <path ${INK} d="M14 14C14 10 34 10 34 14V34C34 38 14 38 14 34Z M18 10V6H30V10 M18 38V42H30V38 M24 42V46 M14 24H34"/>`,
  iron: `<path ${WASH} d="M6 34 12 20H36L42 34Z"/>
    <path ${INK} d="M6 34 12 20H36L42 34Z M12 20 16 14H32L36 20 M18 27H30"/>`,
  trophy: `<path style="fill:var(--ico-gold,#c9a14a)" opacity="0.5" d="M14 6H34V18C34 26 28 30 24 30S14 26 14 18Z"/>
    <path ${INK} d="M14 6H34V18C34 26 28 30 24 30S14 26 14 18Z M14 10H6C6 18 10 20 14 20 M34 10H42C42 18 38 20 34 20 M24 30V38 M16 42H32 M18 38H30V42"/>`,

  // ---- 角色 ----
  hero: `<path ${WASH} d="M24 16 13 43H35Z"/>
    <path ${INK} d="M24 16 13 43H35Z M19 22 8 32 M29 22 40 30 M24 16V43 M18 30H30"/>
    <circle cx="24" cy="10" r="5.5" ${INK}/><circle cx="24" cy="3.6" r="2.2" fill="currentColor"/>
    <path ${INK} d="M31 4 41 0"/><path ${RED} d="M30 26h3v5h-3Z"/>`,
  puppet: `<path ${WASH} d="M16 16H32V34H16Z"/>
    <path ${INK} d="M16 16H32V34H16Z M24 6V16 M16 22 8 28 M32 22 40 28 M20 34 18 44 M28 34 30 44"/>
    <circle cx="24" cy="6" r="4" ${INK}/><path ${PAPER} stroke="currentColor" stroke-width="1.6" d="M21 8H27V16H21Z"/>
    <path ${RED} d="M23 10h2v4h-2Z"/>`,

  // ---- 妖獸 ----
  'm-ape': `<circle cx="24" cy="24" r="16" ${WASH}/>
    <path ${INK} d="M24 8C14 8 8 16 8 25S15 41 24 41 40 34 40 25 34 8 24 8Z M13 19 21 22 M35 19 27 22 M18 33Q24 29 30 33 M20 33 21 37 M28 33 27 37"/>
    <circle cx="18" cy="25" r="2.4" ${RED}/><circle cx="30" cy="25" r="2.4" ${RED}/>`,
  'm-fox': `<path ${WASH} d="M8 8 18 18H30L40 8 38 26 24 40 10 26Z"/>
    <path ${INK} d="M8 8 18 18H30L40 8 38 26 24 40 10 26Z M18 26 22 28 M30 26 26 28 M22 35H26"/>
    <path ${INK} stroke-width="2" d="M40 30c6 2 7 9 2 12"/><circle cx="20" cy="26" r="1.8" ${RED}/><circle cx="28" cy="26" r="1.8" ${RED}/>`,
  'm-tree': `<path ${WASH} d="M17 44 19 22H29L31 44Z"/>
    <path ${INK} d="M17 44 19 22H29L31 44 M19 22C8 22 6 10 14 8 16 2 30 2 34 8 42 10 40 22 29 22 M19 30h3 M26 30h3 M21 37Q24 34 27 37 M11 44H37"/>`,
  'm-skull': `<path ${WASH} d="M24 6C13 6 8 14 8 22 8 29 13 32 15 33V40H33V33C35 32 40 29 40 22 40 14 35 6 24 6Z"/>
    <path ${INK} d="M24 6C13 6 8 14 8 22 8 29 13 32 15 33V40H33V33C35 32 40 29 40 22 40 14 35 6 24 6Z M20 40V36 M24 40V36 M28 40V36 M22 30 24 26 26 30"/>
    <circle cx="18" cy="21" r="4" fill="currentColor"/><circle cx="30" cy="21" r="4" fill="currentColor"/>`,
  'm-spider': `<circle cx="24" cy="28" r="9" ${WASH}/>
    <path ${INK} d="M15 22 4 12 M15 26 3 26 M16 31 5 40 M18 35 12 45 M33 22 44 12 M33 26 45 26 M32 31 43 40 M30 35 36 45"/>
    <circle cx="24" cy="28" r="9" ${INK}/><circle cx="24" cy="15" r="5" ${INK}/>
    <circle cx="22" cy="14" r="1.4" ${RED}/><circle cx="26" cy="14" r="1.4" ${RED}/>`,
  'm-ghost': `<path ${WASH} d="M10 42V20C10 11 17 5 24 5S38 11 38 20V42L33 37 28 43 24 38 20 43 15 37Z"/>
    <path ${INK} d="M10 42V20C10 11 17 5 24 5S38 11 38 20V42L33 37 28 43 24 38 20 43 15 37Z M19 29Q24 33 29 29"/>
    <ellipse cx="18.5" cy="19" rx="3" ry="4" fill="currentColor"/><ellipse cx="29.5" cy="19" rx="3" ry="4" fill="currentColor"/>`,
  'm-golem': `<path ${WASH} d="M15 6H33V18H40V34H33V44H15V34H8V18H15Z"/>
    <path ${INK} d="M15 6H33V18H40V34H33V44H15V34H8V18H15Z M15 18H33V34H15 M20 12h2 M26 12h2 M22 26 26 30"/>
    <path ${RED} d="M19 11h4v3h-4Z M25 11h4v3h-4Z"/>`,
  'm-demon': `<path ${WASH} d="M24 10C15 10 10 18 10 26S16 42 24 42 38 34 38 26 33 10 24 10Z"/>
    <path ${INK} d="M24 10C15 10 10 18 10 26S16 42 24 42 38 34 38 26 33 10 24 10Z M14 14C10 8 8 4 12 2 14 6 16 9 19 11 M34 14C38 8 40 4 36 2 34 6 32 9 29 11 M16 23 21 26 M32 23 27 26 M18 34Q24 38 30 34"/>
    <circle cx="19" cy="28" r="2" ${RED}/><circle cx="29" cy="28" r="2" ${RED}/>`,
  'm-dragon': `<path ${INK} d="M6 40C14 40 14 30 22 30S30 40 38 34C44 30 42 20 36 18"/>
    <path ${WASH} d="M28 8 40 12 42 22 34 24 28 18Z"/>
    <path ${INK} d="M28 8 40 12 42 22 34 24 28 18Z M30 8 26 2 M36 10 38 3 M42 20 46 24"/>
    <circle cx="35" cy="15" r="1.8" ${RED}/>
    <path ${INK} stroke-width="2" d="M12 38 10 34 M18 32 17 28 M26 33 27 29"/>`,
  'm-chaos': `<path ${WASH} d="M24 6C34 6 42 14 40 24 39 34 32 40 24 40S8 34 8 24 14 6 24 6Z"/>
    <path ${INK} d="M24 6C34 6 42 14 40 24 39 34 32 40 24 40S8 34 8 24 14 6 24 6Z M12 36 6 44 M20 40 18 46 M30 40 32 46 M36 36 42 44"/>
    <ellipse cx="24" cy="22" rx="9" ry="6" ${INK}/><circle cx="24" cy="22" r="3.4" ${RED}/>`,
  taotie: `<path ${WASH} d="M6 14 16 10H32L42 14 40 34 30 42H18L8 34Z"/>
    <path ${INK} d="M6 14 16 10H32L42 14 40 34 30 42H18L8 34Z M6 14C2 8 4 3 10 4 M42 14C46 8 44 3 38 4 M24 10V42 M12 22c4-4 8-2 8 2 M36 22c-4-4-8-2-8 2 M16 34H32 M18 34V38 M30 34V38"/>
    <circle cx="16" cy="25" r="2.6" ${RED}/><circle cx="32" cy="25" r="2.6" ${RED}/>`,

  // ---- 秘境 ----
  cave: `<path ${WASH} d="M3 42 16 14 26 24 33 12 45 42Z"/>
    <path ${INK} d="M3 42 16 14 26 24 33 12 45 42 M17 42C17 33 20 29 24 29S31 33 31 42"/>
    <path ${JADE} opacity="0.7" d="M21 42 23 35 25 42Z M26 42 28 37 29 42Z"/>`,
  pagoda: `<path ${WASH} d="M16 40V30H32V40Z"/>
    <path ${INK} d="M24 2V8 M14 14Q24 6 34 14 M17 14V20H31V14 M11 24Q24 15 37 24 M15 24V30H33V24 M8 34Q24 24 40 34 M13 34V44H35V34 M22 44V38H26V44"/>`,

  // ---- 其他 ----
  lock: `<path ${WASH} d="M12 22H36V42H12Z"/>
    <path ${INK} d="M12 22H36V42H12Z M17 22V15C17 7 31 7 31 15V22 M24 29V35"/>`,
  lightning: `<path ${RED} opacity="0.85" d="M27 3 12 27H22L18 45 36 19H25Z"/>
    <path ${INK} d="M27 3 12 27H22L18 45 36 19H25Z"/>`,
  incense: `<path ${INK} d="M12 40H36 M15 40 17 34H31L33 40 M20 34V16 M24 34V12 M28 34V18"/>
    <path ${INK} stroke-width="1.8" opacity="0.6" d="M20 13c-3-3 3-5 0-9 M24 9c-3-3 3-4 0-8 M28 15c-3-3 3-5 0-9"/>
    <circle cx="24" cy="12" r="1.6" ${RED}/>`,
  cycle: `<path ${INK} d="M38 20A15 15 0 0 0 11 16 M10 28A15 15 0 0 0 37 32 M11 8V16H19 M37 40V32H29"/>`,
  door: `<path ${WASH} d="M12 6H36V44H12Z"/>
    <path ${INK} d="M12 6H36V44H12Z M24 6V44 M8 44H40 M20 25h1 M27 25h1"/>`,
  star: `<path ${INK} d="M24 4V44 M4 24H44 M10 10 38 38 M38 10 10 38" stroke-width="2"/><circle cx="24" cy="24" r="5" fill="currentColor"/>`,
  moon: `<path ${WASH} d="M30 6A18 18 0 1 0 42 32 14 14 0 1 1 30 6Z"/>
    <path ${INK} d="M30 6A18 18 0 1 0 42 32 14 14 0 1 1 30 6Z M8 42c4-2 8 2 12 0"/>`,
  bell: `<path ${WASH} d="M12 36C12 22 14 10 24 10S36 22 36 36Z"/>
    <path ${INK} d="M8 36H40 M12 36C12 22 14 10 24 10S36 22 36 36 M24 4V10 M20 40Q24 46 28 40"/>`,
  book: `<path ${WASH} d="M8 10H24V40H8Z"/>
    <path ${INK} d="M8 10H24V40H8Z M24 10H40V40H24 M12 16H20 M28 16H36 M28 22H36"/>`,
  gourd: `<path ${WASH} d="M24 12C19 12 18 18 21 21 13 23 11 36 18 41 22 44 26 44 30 41 37 36 35 23 27 21 30 18 29 12 24 12Z"/>
    <path ${INK} d="M24 12C19 12 18 18 21 21 13 23 11 36 18 41 22 44 26 44 30 41 37 36 35 23 27 21 30 18 29 12 24 12Z M24 12V6 M24 7C28 3 32 6 30 9"/>`,
  check: `<path ${INK} stroke-width="3.4" d="M8 26 19 37 41 11"/>`,
  seal: `<path ${RED} d="M8 8H40V40H8Z"/>
    <path fill="none" style="stroke:var(--ico-paper,#e8d59c)" stroke-width="2.6" stroke-linecap="round" d="M14 15H34 M24 15V34 M15 24H33 M16 33H32"/>`,
};

/** 把所有圖示插入頁面一次（含水墨筆觸濾鏡） */
function installIconSprite() {
  if (document.getElementById('icon-sprite')) return;
  const symbols = Object.entries(ICON_PATHS)
    .map(([name, body]) => `<symbol id="ico-${name}" viewBox="0 0 48 48"><g filter="url(#ink-edge)">${body}</g></symbol>`)
    .join('');
  const wrap = document.createElement('div');
  wrap.innerHTML = `<svg id="icon-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
    style="position:absolute;width:0;height:0;overflow:hidden">
    <defs>
      <!-- 讓線條邊緣有毛筆暈開的粗糙感 -->
      <filter id="ink-edge" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>${symbols}</svg>`;
  document.body.prepend(wrap.firstElementChild);
}

/**
 * 取得圖示標記
 * @param {string} name 圖示名稱（ICON_PATHS 的 key）
 * @param {string} cls  額外 class（例如 'ico-lg'）
 */
function icon(name, cls = '') {
  if (!ICON_PATHS[name]) return '';
  return `<svg class="ico ${cls}" aria-hidden="true"><use href="#ico-${name}"/></svg>`;
}

/** 把 HTML 裡 data-icon="名稱" 的元素填入對應圖示 */
function fillStaticIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, el.dataset.iconClass || '');
  });
}
