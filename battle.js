// @ts-check
/* =========================================================
 * battle.js — 戰鬥邏輯（主線與副本共用）
 *
 * 以時間驅動：雙方依攻速累積攻擊進度，進度滿 1 即出手。
 * 這個檔案不碰畫面，只透過 battle.onEvent 回報發生的事件，
 * 由呼叫端（stage.js / dungeon.js）決定要不要轉給 ui.js 播放。
 * ========================================================= */

/**
 * 建立戰鬥單位
 * @param {StatMap} stats  { atk, hp, def, spd, critRate, critDmg, lifesteal, dodge }
 * @param {{name?: string, emoji?: string, color?: string, isBoss?: boolean, immortal?: boolean, mechanic?: any, dmgTakenMult?: number}} info 顯示用資料（immortal：不會死亡，上古妖王用；mechanic：主線 Boss 機制，見 CONFIG.bossMechanics；dmgTakenMult：受到的傷害倍率，誅魔）
 * @returns {Fighter}
 */
function createFighter(stats, info = {}) {
  const maxHp = Math.max(1, Math.round(stats.hp));
  return {
    ...info,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    critRate: stats.critRate || 0,
    critDmg: stats.critDmg || 1,
    lifesteal: stats.lifesteal || 0,
    dodge: stats.dodge || 0,
    maxHp,
    hp: maxHp,
    progress: 0, // 攻擊進度，滿 1 出手
    skill: null, // 技能（見 setFighterSkill）
    pets: [], // 一起作戰的靈獸（見 setFighterPets）
    effects: [], // 仙品法寶特效（見 gear.js getEquippedEffects）
    shieldLeft: 0, // 減傷剩餘秒數
    shieldReduction: 0, // 減傷比例
    shieldBlocksSkills: false, // 減傷是否也擋技能類傷害（鬼甲）
    lastHit: '', // 最後一次受傷的來源（死因）：attack / poison / thunder / backlash
    talent: {}, // 道途天賦效果（主角才有；見 dao.js getDaoTalentEffect）
    gearFx: {}, // 強化里程碑 +12、靈獸羈絆的小特效（主角才有；見 gear.js getHeroFx）
    petBuffs: {}, // 靈獸 4 星技能、覺醒技給主角的短暫增益：{ critRate|critDmg|atkPct|dmgTaken: { left 秒, value } }
    surviveChance: 0, // 護命（飛升天賦玄體，主角才有）：受到致命傷害時保留 1 點氣血的機率，每場一次
  };
}

/** 靈獸給的短暫增益數值（沒有或已過期為 0） */
function getPetBuff(f, key) {
  const b = f.petBuffs && f.petBuffs[key];
  return b && b.left > 0 ? b.value : 0;
}

/** 這個目標受到的傷害倍率（飛升天賦「誅魔」：主線 Boss 的 dmgTakenMult；其他目標 1） */
function getDmgTakenMult(target) {
  return (target && target.dmgTakenMult) || 1;
}

/** 敵人身上的 Boss 機制 id（沒有則為空字串） */
function getMechanicId(fighter) {
  return fighter && fighter.mechanic ? fighter.mechanic.id : '';
}

/**
 * 技能類傷害（道途技能、靈獸、仙品雷擊、Boss 雷霆）套用目標的減傷
 * @param {boolean} force 不論減傷種類都套用（雷霆：主角自己的減傷都有效）
 */
function reduceSkillDamage(target, damage, force = false) {
  const g = target.gearFx;
  if (g && g.skillTakenReduce) damage = Math.max(1, Math.round(damage * (1 - g.skillTakenReduce))); // 道冠 +12
  const guard = getPetBuff(target, 'dmgTaken');
  if (guard) damage = Math.max(1, Math.round(damage * (1 - guard))); // 玄龜 4 星
  if (target.shieldLeft > 0 && (force || target.shieldBlocksSkills)) {
    return Math.max(1, Math.round(damage * (1 - target.shieldReduction)));
  }
  return damage;
}

/**
 * 設定戰鬥單位的技能
 * @param {Object|null} skillCfg 技能設定（CONFIG.dao…skill）
 * @param {boolean} keepTimer    同一個技能時保留目前冷卻進度
 */
function setFighterSkill(fighter, skillCfg, keepTimer = true) {
  if (!skillCfg) {
    fighter.skill = null;
    return;
  }
  const same = keepTimer && fighter.skill && fighter.skill.name === skillCfg.name;
  fighter.skill = { ...skillCfg, timer: same ? fighter.skill.timer : 0 };
}

/**
 * 設定一起作戰的靈獸；同一隻靈獸保留目前的攻擊冷卻
 * @param {Object[]} attacks 靈獸攻擊清單（getDeployedBeastAttacks）
 */
function setFighterPets(fighter, attacks) {
  const old = {};
  for (const p of fighter.pets || []) old[p.key] = p.timer;
  fighter.pets = attacks.map((a) => ({ ...a, timer: old[a.key] || 0 }));
}

/** 目前的攻擊力（天賦「不動明王」：護體期間攻擊 +比例；「浴血」：氣血低於門檻時攻擊 +比例） */
function getFighterAtk(f) {
  const t = f.talent;
  let atk = f.atk;
  if (!t) return atk * (1 + getPetBuff(f, 'atkPct'));
  if (t.shieldAtkPct && f.shieldLeft > 0) atk *= 1 + t.shieldAtkPct;
  if (t.lowHpAtkPct && f.hp < f.maxHp * t.lowHpBelow) atk *= 1 + t.lowHpAtkPct;
  return atk * (1 + getPetBuff(f, 'atkPct')); // 麒麟 4 星
}

/**
 * 依倍率計算一次技能類傷害（受防禦影響、不會暴擊）
 * @param {number} [pierceDef] 無視目標護體的比例（天賦「破甲神雷」）
 */
function calcSkillDamage(attacker, target, mult, pierceDef = 0) {
  const cfg = CONFIG.battle;
  const power = getFighterAtk(attacker) * mult;
  const def = target.def * (1 - pierceDef);
  return Math.max(1, Math.round(Math.max(power - def * cfg.defFactor, power * cfg.minDamageRatio)));
}

/**
 * 建立一場戰鬥
 * @param {Object} opts
 *   timeLimit       限時秒數（0 = 不限時）
 *   immortalEnemy   敵人不會死（世界 Boss 用）
 *   onEvent         事件回呼 (event) => {}
 */
function createBattle(hero, enemy, opts = {}) {
  hero.progress = 0;
  enemy.progress = 0;
  hero.lastHit = ''; // 這一場還沒受過傷（死因、挑戰型成就「毫髮無傷」用）
  // 先手（靈獸覺醒，B3）：覺醒的靈獸每場戰鬥一開始就出手一次，之後照原本冷卻
  for (const p of hero.pets || []) {
    if (!p.opener) continue;
    p.timer = Math.max(p.timer, p.cooldown);
    p.openerPending = true;
  }
  return {
    hero,
    enemy,
    time: 0,
    timeLimit: opts.timeLimit || 0,
    immortalEnemy: !!opts.immortalEnemy,
    surviveUsed: false, // 護命（玄體）這場用過了沒（tryHeroSurvive）
    onEvent: opts.onEvent || null,
    totalDamage: 0, // 主角造成的總傷害（副本用）
    result: null, // null 進行中 / 'win' / 'lose' / 'timeout'
    openedSkill: { hero: false, enemy: false }, // 這場戰鬥是否已經做過「開戰立即施放」
    firstAttackDone: { hero: false, enemy: false }, // 這場戰鬥是否已經出過第一次一般攻擊（雲履 +12）
    mech: { timer: 0, count: 0, enraged: false, thunderHits: [] }, // Boss 機制的計時與紀錄（count：鬼甲／雷霆／狂暴觸發次數；thunderHits：每次雷霆實際傷害 ÷ 主角最大氣血）
  };
}

/**
 * 計算一次攻擊的結果
 * 基礎傷害 = max(atk - def × defFactor, atk × minDamageRatio)
 * 閃避 → 0；暴擊 → × critDmg；最終取整數（至少 1）
 */
function rollAttack(attacker, defender, forceCrit = false) {
  const cfg = CONFIG.battle;
  if (Math.random() < defender.dodge) {
    return { damage: 0, crit: false, dodged: true };
  }
  const atk = getFighterAtk(attacker);
  let dmg = Math.max(atk - defender.def * cfg.defFactor, atk * cfg.minDamageRatio);
  const crit = forceCrit || Math.random() < attacker.critRate + getPetBuff(attacker, 'critRate'); // 靈狐 4 星
  if (crit) dmg *= attacker.critDmg + getPetBuff(attacker, 'critDmg'); // 靈狐覺醒技：會心傷害 +
  // 護腕 +12：會心時再追加傷害
  if (crit && attacker.gearFx && attacker.gearFx.critExtra) dmg *= 1 + attacker.gearFx.critExtra;
  // 石膚：主角對它的會心傷害再乘上倍率
  if (crit && defender.mechanic && defender.mechanic.critTakenMult) dmg *= defender.mechanic.critTakenMult;
  return { damage: Math.max(1, Math.round(dmg)), crit, dodged: false };
}

/**
 * 護命（飛升天賦玄體）：主角氣血歸零時，有機率保留 1 點氣血，每場戰鬥一次。
 * 每個「主角氣血 ≤ 0 → 輸」的判定前呼叫；保住時回傳 true（主角氣血變成 1）
 */
function tryHeroSurvive(battle) {
  const hero = battle.hero;
  if (hero.hp > 0 || battle.surviveUsed || !(hero.surviveChance > 0)) return false;
  battle.surviveUsed = true;
  if (Math.random() >= hero.surviveChance) return false;
  hero.hp = 1;
  emitProc(battle, 'hero', { name: '護命！', type: 'survive' }, { survive: true });
  return true;
}

/** 回報仙品特效觸發（畫面顯示特效名稱） */
function emitProc(battle, side, effect, extra) {
  if (battle.onEvent) battle.onEvent({ type: 'proc', side, name: effect.name, kind: effect.type, ...extra });
}

/**
 * 執行一次攻擊並回報事件
 * @param {boolean} isEcho 是不是「連擊」特效多出來的攻擊（避免無限連擊）
 */
function performAttack(battle, attacker, defender, side, isEcho = false) {
  // 雲履 +12：每場戰鬥第一次一般攻擊必定會心（被閃避也算用掉）
  let forceCrit = false;
  if (!battle.firstAttackDone[side]) {
    battle.firstAttackDone[side] = true;
    forceCrit = !!(attacker.gearFx && attacker.gearFx.firstCrit);
  }
  const hit = rollAttack(attacker, defender, forceCrit);
  const immortal = side === 'hero' && battle.immortalEnemy;
  const atkEffects = attacker.effects || [];
  const defEffects = defender.effects || [];

  // 斬殺：敵人血量低於門檻時增傷
  if (!hit.dodged) {
    for (const e of atkEffects) {
      if (e.type === 'execute' && !immortal && defender.hp / defender.maxHp < e.threshold) {
        hit.damage = Math.round(hit.damage * (1 + e.bonus));
        hit.proc = e.name;
      }
    }
  }

  // 誅魔（飛升天賦）：對主線 Boss 的一般攻擊傷害 ×倍率
  if (!hit.dodged && getDmgTakenMult(defender) !== 1) hit.damage = Math.max(1, Math.round(hit.damage * getDmgTakenMult(defender)));

  // 道袍 +12、玄甲雷鳴羈絆：受到的一般攻擊減少；玄龜 4 星：短暫減傷
  if (!hit.dodged && defender.gearFx && defender.gearFx.attackTakenReduce) {
    hit.damage = Math.max(1, Math.round(hit.damage * (1 - defender.gearFx.attackTakenReduce)));
  }
  if (!hit.dodged && getPetBuff(defender, 'dmgTaken')) {
    hit.damage = Math.max(1, Math.round(hit.damage * (1 - getPetBuff(defender, 'dmgTaken'))));
  }
  // 減傷（例如體修「金剛不壞」）；天劫的妖獸穿透一部分（shieldPierce，v1.2）
  if (!hit.dodged && defender.shieldLeft > 0) {
    hit.damage = Math.max(1, Math.round(hit.damage * (1 - defender.shieldReduction * (1 - (attacker.shieldPierce || 0)))));
    hit.shielded = true;
  }
  // 仙品護身：機率大幅減傷
  if (!hit.dodged) {
    for (const e of defEffects) {
      if (e.type === 'guard' && Math.random() < e.chance) {
        hit.damage = Math.max(1, Math.round(hit.damage * (1 - e.reduction)));
        emitProc(battle, side === 'hero' ? 'enemy' : 'hero', e, { guarded: true });
        break;
      }
    }
  }

  if (!hit.dodged) {
    defender.hp = immortal ? defender.hp : Math.max(0, defender.hp - hit.damage);
    if (side === 'hero') battle.totalDamage += hit.damage;
    else defender.lastHit = 'attack';
  }

  // 吸血：依實際傷害回血，不超過最大血量（屍毒：主角的吸血無效）
  let heal = 0;
  const noLifesteal = side === 'hero' && getMechanicId(defender) === 'noLifesteal';
  const at = attacker.talent || {};
  const lifesteal = attacker.lifesteal;
  if (hit.damage > 0 && lifesteal > 0 && !noLifesteal) {
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(hit.damage * lifesteal));
    heal = attacker.hp - before;
  }
  // 天賦「劍氣護體」：一般攻擊會心時回復最大氣血的一定比例（不是吸血，屍毒下也有效）
  if (at.critHealPct && hit.crit && !hit.dodged && attacker.hp > 0) {
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(attacker.maxHp * at.critHealPct));
    heal += attacker.hp - before;
  }

  if (battle.onEvent) {
    battle.onEvent({ type: 'attack', side, damage: hit.damage, crit: hit.crit, dodged: hit.dodged, heal, shielded: !!hit.shielded, proc: hit.proc });
  }

  // 天賦「金鐘罩」：護體期間把受到的傷害（減傷後）反彈給攻擊者（算技能類傷害，會被鬼甲減傷）
  const dft = defender.talent || {};
  if (dft.reflectPct && defender.shieldLeft > 0 && !hit.dodged && hit.damage > 0) {
    const reflect = reduceSkillDamage(attacker, Math.max(1, Math.round(hit.damage * dft.reflectPct * getDmgTakenMult(attacker)))); // 反彈給主線 Boss 也算誅魔
    const immortalAtk = side === 'enemy' && battle.immortalEnemy;
    if (!immortalAtk) attacker.hp = Math.max(0, attacker.hp - reflect);
    if (side === 'enemy') battle.totalDamage += reflect;
    if (battle.onEvent) battle.onEvent({ type: 'talent', side: side === 'hero' ? 'enemy' : 'hero', id: 'reflect', damage: reflect });
  }

  // 反噬：主角的一般攻擊會心時，自己受到反彈（每次有上限）
  const mech = side === 'hero' ? defender.mechanic : null;
  if (mech && mech.id === 'backlash' && hit.crit && !hit.dodged) {
    const reflect = Math.max(1, Math.round(Math.min(hit.damage * mech.reflectPct, attacker.maxHp * mech.reflectCapPct)));
    attacker.hp = Math.max(0, attacker.hp - reflect);
    attacker.lastHit = 'backlash';
    if (battle.onEvent) battle.onEvent({ type: 'mech', id: mech.id, name: mech.name, damage: reflect });
  }

  // 攻擊後觸發的仙品特效
  if (hit.dodged || defender.hp <= 0) return;
  for (const e of atkEffects) {
    if (defender.hp <= 0) break;
    if (e.type === 'thunder' && Math.random() < e.chance) {
      const damage = reduceSkillDamage(defender, Math.max(1, Math.round(calcSkillDamage(attacker, defender, e.mult) * getDmgTakenMult(defender)))); // 誅魔
      if (!immortal) defender.hp = Math.max(0, defender.hp - damage);
      if (side === 'hero') battle.totalDamage += damage;
      emitProc(battle, side, e, { damage });
    } else if (e.type === 'heal' && Math.random() < e.chance) {
      const before = attacker.hp;
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + Math.round(attacker.maxHp * e.pct));
      emitProc(battle, side, e, { heal: attacker.hp - before });
    } else if (e.type === 'echo' && !isEcho && Math.random() < e.chance) {
      emitProc(battle, side, e, {});
      performAttack(battle, attacker, defender, side, true);
    }
  }
}

/**
 * 推進技能冷卻；冷卻好了就施放
 *   damage：造成 mult 倍攻擊的傷害（同樣受防禦影響，不會暴擊）
 *   shield：獲得 duration 秒、減傷 reduction 的護體
 */
function updateSkill(battle, caster, target, side, dt) {
  if (caster.shieldLeft > 0) caster.shieldLeft = Math.max(0, caster.shieldLeft - dt);
  const sk = caster.skill;
  if (!sk || battle.result) return;
  // 每場戰鬥的第一步：
  //   castAtStart（體修護體）把冷卻填滿 → 立即施放
  //   firstCooldownMult（天賦「先發制人」）：這場第一次施放只要冷卻 × 倍率（冷卻進度不足時補到那裡）
  if (!battle.openedSkill[side] && (sk.castAtStart || sk.firstCooldownMult)) {
    battle.openedSkill[side] = true;
    if (sk.castAtStart) sk.timer = Math.max(sk.timer, sk.cooldown);
    else sk.timer = Math.max(sk.timer, sk.cooldown * (1 - sk.firstCooldownMult));
  } else {
    sk.timer += dt;
  }
  if (sk.timer < sk.cooldown) return;
  sk.timer -= sk.cooldown;

  if (sk.type === 'damage') {
    castDamageSkill(battle, caster, target, side, sk);
    // 天賦「連雷」：機率再施放一次（再施放的不會再觸發）
    if (sk.recastChance && !battle.result && Math.random() < sk.recastChance) castDamageSkill(battle, caster, target, side, sk, true);
  } else if (sk.type === 'shield') {
    caster.shieldLeft = sk.duration;
    caster.shieldReduction = sk.reduction;
    if (battle.onEvent) battle.onEvent({ type: 'skill', side, kind: 'shield', name: sk.name, duration: sk.duration });
  }
}

/**
 * 施放一次傷害技能
 *   天賦：skillCrit 可會心（石膚的會心增傷也算）、executeBelow 低血量增傷、pierceShield／pierceDef 破甲
 */
function castDamageSkill(battle, caster, target, side, sk, recast = false) {
  let damage = calcSkillDamage(caster, target, sk.mult, sk.pierceDef || 0);
  if (caster.gearFx && caster.gearFx.skillDmgPct) damage *= 1 + caster.gearFx.skillDmgPct; // 飛劍 +12
  let crit = false;
  if (sk.skillCrit && Math.random() < caster.critRate) {
    crit = true;
    damage *= caster.critDmg;
    if (target.mechanic && target.mechanic.critTakenMult) damage *= target.mechanic.critTakenMult;
  }
  if (sk.executeBelow && target.hp < target.maxHp * sk.executeBelow) damage *= sk.executeMult;
  damage *= getDmgTakenMult(target); // 誅魔
  damage = Math.max(1, Math.round(damage));
  if (!sk.pierceShield) damage = reduceSkillDamage(target, damage);
  const immortal = side === 'hero' && battle.immortalEnemy;
  if (!immortal) target.hp = Math.max(0, target.hp - damage);
  if (side === 'hero') battle.totalDamage += damage;
  if (battle.onEvent) battle.onEvent({ type: 'skill', side, kind: 'damage', name: sk.name, damage, crit, recast });
  if (target.hp <= 0 && !(side !== 'hero' && tryHeroSurvive(battle))) battle.result = side === 'hero' ? 'win' : 'lose';
}

/** 靈獸的自動攻擊：每隻各自冷卻，好了就以主角的攻擊力 × 倍率出手（4 星專屬效果見 CONFIG.beasts.starSkills） */
function updatePets(battle, owner, target, side, dt) {
  // 靈獸給的短暫增益倒數
  if (owner.petBuffs) for (const b of Object.values(owner.petBuffs)) if (b.left > 0) b.left = Math.max(0, b.left - dt);
  const pets = owner.pets;
  if (!pets || pets.length === 0) return;
  pets.forEach((pet, index) => {
    if (battle.result) return;
    pet.timer += dt;
    if (pet.timer < pet.cooldown) return;
    pet.timer -= pet.cooldown;
    const opener = !!pet.openerPending;
    pet.openerPending = false;
    petStrike(battle, owner, target, side, pet, index, false, opener);
    // 雷貂 4 星：機率再出手一次（再出手的不會再觸發）
    const e = pet.star4;
    if (e && e.echoChance && !battle.result && Math.random() < e.echoChance) petStrike(battle, owner, target, side, pet, index, true);
  });
}

/** 靈獸出手一次（含 4 星專屬效果、覺醒技；opener：這一擊是先手） */
function petStrike(battle, owner, target, side, pet, index, echo = false, opener = false) {
  const immortal = side === 'hero' && battle.immortalEnemy;
  const e = pet.star4 || {};
  let raw = calcSkillDamage(owner, target, pet.mult);
  let mult = 1;
  if (owner.gearFx && owner.gearFx.petDmgPct) mult += owner.gearFx.petDmgPct; // 玉佩 +12、狐火燎原羈絆
  if (e.bossDmgPct && target.isBoss) mult += e.bossDmgPct; // 赤焰鳥 4 星
  mult *= getDmgTakenMult(target); // 誅魔
  if (mult !== 1) raw = Math.round(raw * mult);
  const damage = reduceSkillDamage(target, raw);
  if (!immortal) target.hp = Math.max(0, target.hp - damage);
  if (side === 'hero') battle.totalDamage += damage;
  // 4 星：命中或施放後的增益、回血
  if (!owner.petBuffs) owner.petBuffs = {};
  if (e.buffCritRate) owner.petBuffs.critRate = { left: e.buffSec, value: e.buffCritRate };
  if (e.buffAtkPct) owner.petBuffs.atkPct = { left: e.buffSec, value: e.buffAtkPct };
  if (e.buffCritDmg) owner.petBuffs.critDmg = { left: e.buffSec, value: e.buffCritDmg };
  if (e.buffDmgTaken) owner.petBuffs.dmgTaken = { left: e.buffSec, value: e.buffDmgTaken };
  let heal = 0;
  if (e.healPct && owner.hp > 0) {
    const before = owner.hp;
    owner.hp = Math.min(owner.maxHp, owner.hp + Math.round(owner.maxHp * e.healPct));
    heal = owner.hp - before;
  }
  if (battle.onEvent) battle.onEvent({ type: 'pet', side, index, key: pet.key, name: pet.name, damage, echo, heal, opener });
  if (target.hp <= 0 && !(side !== 'hero' && tryHeroSurvive(battle))) battle.result = side === 'hero' ? 'win' : 'lose';
}

/**
 * 推進戰鬥 dt 秒（建議用固定的小步長呼叫）
 * @returns {string|null} 戰鬥結果
 */
function stepBattle(battle, dt) {
  if (battle.result) return battle.result;
  const { hero, enemy } = battle;
  battle.time += dt;

  // 主角先累積、先出手（同時到達時主角優先）
  hero.progress += hero.spd * dt;
  while (hero.progress >= 1 && !battle.result) {
    hero.progress -= 1;
    performAttack(battle, hero, enemy, 'hero');
    if (enemy.hp <= 0) battle.result = 'win';
    else if (hero.hp <= 0 && !tryHeroSurvive(battle)) battle.result = 'lose'; // 反噬
  }
  updateBossMechanic(battle, dt);
  if (battle.result) return battle.result;
  updateSkill(battle, hero, enemy, 'hero', dt);
  updatePets(battle, hero, enemy, 'hero', dt);
  updateSkill(battle, enemy, hero, 'enemy', dt);
  if (enemy.mechanic && enemy.mechanic.id === 'enrage') updateBossMechanic(battle, 0); // 技能、靈獸把 Boss 打到一半以下時，這一步的攻擊就狂暴

  enemy.progress += enemy.spd * dt;
  while (enemy.progress >= 1 && !battle.result) {
    enemy.progress -= 1;
    performAttack(battle, enemy, hero, 'enemy');
    if (hero.hp <= 0 && !tryHeroSurvive(battle)) battle.result = 'lose';
    else if (enemy.hp <= 0) battle.result = 'win'; // 金鐘罩反彈
  }

  if (!battle.result && battle.timeLimit > 0 && battle.time >= battle.timeLimit) {
    battle.result = 'timeout';
  }
  return battle.result;
}

/**
 * 主線 Boss 機制（每步呼叫；沒有機制時直接返回）
 *   再生、劇毒：每秒持續生效（畫面只顯示狀態圖示）
 *   鬼甲（開戰立即＋每 8 秒）、雷霆（3 秒＋每 6 秒）：定時觸發；狂暴：Boss 氣血降到一半時觸發
 *   這三種回報 'mech' 事件（畫面跳字），觸發次數記在 battle.mech.count
 */
function updateBossMechanic(battle, dt) {
  const { hero, enemy } = battle;
  const m = enemy.mechanic;
  if (!m || battle.result) return;
  const emit = (extra) => battle.onEvent && battle.onEvent({ type: 'mech', id: m.id, name: m.name, ...extra });
  switch (m.id) {
    case 'regen':
      if (enemy.hp > 0) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * m.regenPct * dt);
      break;
    case 'poison':
      hero.hp = Math.max(0, hero.hp - hero.maxHp * m.poisonPct * dt); // 無視護體與減傷
      hero.lastHit = 'poison';
      if (hero.hp <= 0 && !tryHeroSurvive(battle)) battle.result = 'lose';
      break;
    case 'ghostShield': {
      // 開戰立即觸發第一次，之後每 interval 秒
      let due = battle.mech.count === 0;
      if (!due) {
        battle.mech.timer += dt;
        due = battle.mech.timer >= m.interval;
        if (due) battle.mech.timer -= m.interval;
      }
      if (due) {
        battle.mech.count++;
        enemy.shieldLeft = m.duration;
        enemy.shieldReduction = m.reduction;
        enemy.shieldBlocksSkills = true;
        emit({ duration: m.duration });
      }
      break;
    }
    case 'thunder':
      // 第一次在 firstAt 秒，之後每 interval 秒
      battle.mech.timer += dt;
      if (battle.mech.timer >= (battle.mech.count === 0 ? m.firstAt : m.interval)) {
        battle.mech.timer -= battle.mech.count === 0 ? m.firstAt : m.interval;
        battle.mech.count++;
        if (Math.random() < hero.dodge) {
          emit({ dodged: true });
          break;
        }
        let damage = reduceSkillDamage(hero, calcSkillDamage(enemy, hero, m.mult), true); // 主角自己的減傷有效
        // 仙品護身：機率大幅減傷
        for (const e of hero.effects || []) {
          if (e.type === 'guard' && Math.random() < e.chance) {
            damage = Math.max(1, Math.round(damage * (1 - e.reduction)));
            emitProc(battle, 'hero', e, { guarded: true });
            break;
          }
        }
        damage = Math.max(1, Math.min(damage, Math.round(hero.maxHp * m.capPct))); // 單次上限（減傷後）
        hero.hp = Math.max(0, hero.hp - damage);
        hero.lastHit = 'thunder';
        battle.mech.thunderHits.push(damage / hero.maxHp);
        emit({ damage });
        if (hero.hp <= 0 && !tryHeroSurvive(battle)) battle.result = 'lose';
      }
      break;
    case 'enrage':
      // Boss 氣血降到 hpBelow 以下時觸發一次
      if (!battle.mech.enraged && enemy.hp > 0 && enemy.hp <= enemy.maxHp * m.hpBelow) {
        battle.mech.enraged = true;
        battle.mech.count++;
        enemy.atk *= m.atkMult;
        emit({});
      }
      break;
  }
}

/** 限時戰鬥的剩餘秒數 */
function getBattleTimeLeft(battle) {
  if (!battle || !battle.timeLimit) return 0;
  return Math.max(0, battle.timeLimit - battle.time);
}
