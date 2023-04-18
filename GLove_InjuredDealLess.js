/**********************************
*This plugin does 2 thing : 
* - It changes the way damage is calculated with new attribute I made for my game, remove avoidance etc. You probably don't want that and will have to adapt the damage with your own formulas
* - It reduces damage an attacker deals based on its missing health (50% like attacker will do only half dmg etc)
* Known issues : 
* -It might not work with multiHit attack, more specificaly, if several attack are dealt before a counterAttack, the counterAttack might not properly take into account Hp change done by the recent multiStrikes
* Comment with 4 '////' are those I added myself, comment with '//' are original comment from block of code I took from SRPG's code
******************************/
////Modified singleton-calculator to change the way damage is calculateDamage
////Damage will be POW - finalDef - targetRES - terrainRES
////POW is the STR
////PEN is the SKI stat
////finalDef is the DEF of the target minus the PEN of the attack
////targetRES is RES of the target, terrainRES is the RES of the terrain if applicable

////****Override of Ability calculator, You probably want to remove/remake this part to fit your damage calculation well*****
var AbilityCalculator = {
	getPower: function(unit, weapon) {
		var pow;
			pow = RealBonus.getStr(unit);
		
		return pow ////Physical and magical power are the same beside we ignore weapon damage, each unit base damage is its POW
	},
	
	getHit: function(unit, weapon) {
		return 200;//// We aren't missing here made it 200 rather than 100 so you don't have to handle terrain avoidance
	},
	
	getAvoid: function(unit) {////no changes here but it doesn't matter, with 200 hit we should never miss
		var avoid, terrain;
		var cls = unit.getClass();
		
		// Avoid is (Spd * 2)
		avoid = RealBonus.getSpd(unit) * 2;
		
		// If class type gains terrain bonus, add the avoid rate of terrain.
		if (cls.getClassType().isTerrainBonusEnabled()) {
			terrain = PosChecker.getTerrainFromPos(unit.getMapX(), unit.getMapY());
			if (terrain !== null) {
				avoid += terrain.getAvoid();
			}
		}
		
		return avoid;
	},
	
	getRES: function(unit) {////This SHOULD get the RES value of the unit and add the RES value of terrain to return total RES (in my game I call this BLK)
		var RES, terrain;
		var cls = unit.getClass();
		
		RES = RealBonus.getMdf(unit);
		
		// If class type gains terrain bonus, add the avoid rate of terrain.
		if (cls.getClassType().isTerrainBonusEnabled()) {
			terrain = PosChecker.getTerrainFromPos(unit.getMapX(), unit.getMapY());
			if (terrain !== null) {
				RES += terrain.Mdf();
			}
		}
		
		return RES;
	},
	
	getCritical: function(unit, weapon) {
		return 0; ////I'm not using Crit in my game
	},
	
	getCriticalAvoid: function(unit) {
		return 0;////I'm not using CRIT in my game
	},
	
	getAgility: function(unit, weapon) {
		////I'm not using AGI in my game
		return 0;
	}
};
////******End of Ability calculator override***************************

////****Override of functions in damageCalculator in order to change how stats affect damage and reduce damage done by injured units**********************

DamageCalculator.calculateDamage = function(active, passive, weapon, isCritical, activeTotalStatus, passiveTotalStatus, trueHitValue) {
		var pow, def, damage,initialDamage,updatedHP;
		
		if (this.isHpMinimum(active, passive, weapon, isCritical, trueHitValue)) {
			return -1;
		}
		
		pow = this.calculateAttackPower(active, passive, weapon, isCritical, activeTotalStatus, trueHitValue);
		def = this.calculateDefense(active, passive, weapon, isCritical, passiveTotalStatus, trueHitValue);
		
		damage = pow - def;
		damage *=active.getHp();////changed to take into account hp of the attacker
		damage /= RealBonus.getMhp(active);////changed to take into account hp of the attacker
		damage = Math.ceil(damage);////SRPG freezes if you feed him float number so we turn it into an int
		if (this.isHalveAttack(active, passive, weapon, isCritical, trueHitValue)) {
			if (!this.isHalveAttackBreak(active, passive, weapon, isCritical, trueHitValue)) {
				damage = Math.floor(damage / 2);
			}
		}
		
		if (this.isCritical(active, passive, weapon, isCritical, trueHitValue)) {
			damage = Math.floor(damage * this.getCriticalFactor());
		}
		
		return this.validValue(active, passive, weapon, damage);
	},
	
	DamageCalculator._calculateDamageInt = function(active, passive, weapon, isCritical, activeTotalStatus, passiveTotalStatus, trueHitValue) {////copy pasta and renamed cause I just wanted a way to collect the result of this function as an int
		var pow, def, damage;
		
		if (this.isHpMinimum(active, passive, weapon, isCritical, trueHitValue)) {
			return -1;
		}
		
		pow = this.calculateAttackPower(active, passive, weapon, isCritical, activeTotalStatus, trueHitValue);
		def = this.calculateDefense(active, passive, weapon, isCritical, passiveTotalStatus, trueHitValue);
		
		damage = pow - def;
		damage *=active.getHp();////changed to take into account hp of the attacker
		damage /= RealBonus.getMhp(active);////changed to take into account hp of the attacker
		damage = Math.ceil(damage);////SRPG freeze if you feed him float number so we turn it into an int
		if (this.isHalveAttack(active, passive, weapon, isCritical, trueHitValue)) {
			if (!this.isHalveAttackBreak(active, passive, weapon, isCritical, trueHitValue)) {
				damage = Math.floor(damage / 2);
			}
		}
		
		if (this.isCritical(active, passive, weapon, isCritical, trueHitValue)) {
			damage = Math.floor(damage * this.getCriticalFactor());
		}
		
		return damage;////<
	},
	
DamageCalculator.calculateDamageCounterAttack = function(active, passive, weapon, isCritical, activeTotalStatus, passiveTotalStatus, trueHitValue) {////Same as calculate damage but called if the unit doing dmg is counterattacking, honestly I should just have added a boolean to calculateDamage
		var pow, def, damage,initialDamage,updatedHP;
		
		if (this.isHpMinimum(active, passive, weapon, isCritical, trueHitValue)) {
			return -1;
		}
		
		pow = this.calculateAttackPower(active, passive, weapon, isCritical, activeTotalStatus, trueHitValue);
		def = this.calculateDefense(active, passive, weapon, isCritical, passiveTotalStatus, trueHitValue);
		
		damage = pow - def;
		initialDamage = DamageCalculator._calculateDamageInt(passive, active, weapon, isCritical, activeTotalStatus, passiveTotalStatus, trueHitValue);////calculating damage taken from the attacker
		updatedHP = active.getHp() - initialDamage;////take into the damage taken by the unit about to counterAttack
		damage *=updatedHP;////changed to take into account hp of the unit doing the counterAttack after receiving the attack
		damage /= RealBonus.getMhp(active);////changed to take into account hp of the attacker
		damage = Math.ceil(damage);////SRPG freeze if you feed him float number so we turn it into an int
		if (this.isHalveAttack(active, passive, weapon, isCritical, trueHitValue)) {
			if (!this.isHalveAttackBreak(active, passive, weapon, isCritical, trueHitValue)) {
				damage = Math.floor(damage / 2);
			}
		}
		
		if (this.isCritical(active, passive, weapon, isCritical, trueHitValue)) {
			damage = Math.floor(damage * this.getCriticalFactor());
		}
		
		return this.validValue(active, passive, weapon, damage);
	},
	
DamageCalculator.calculateDefense = function(active, passive, weapon, isCritical, totalStatus, trueHitValue) {////changed to take into account bot def and RES and PEN
		var RES;
		
		RES = RealBonus.getDef(passive);
		RES -=RealBonus.getSki(active);
		RES = Math.max(0, RES);
		RES += RealBonus.getMdf(passive);
		
		RES += CompatibleCalculator.getDefense(passive, active, ItemControl.getEquippedWeapon(passive)) + SupportCalculator.getDefense(totalStatus);
		
		return RES;
	};
	
	
DamageCalculator.calculateDamageValue = function(targetUnit, damageValue, damageType, plus) {////this is unchanged, change it if you want to change how the damage is calculated in damage event
		var n, def;
		
		// Def to be referred is different depending on DamageType.
		if (damageType === DamageType.FIXED) {
			def = 0;
		}
		else if (damageType === DamageType.PHYSICS) {
			def = RealBonus.getDef(targetUnit);
		}
		else {
			def = RealBonus.getMdf(targetUnit);
		}
		
		n = (damageValue + plus) - def;
		
		if (n < DefineControl.getMinDamage()) {
			n = DefineControl.getMinDamage();
		}
		
		return n;
	};
////****End of damageCalculator Override**********************

////Change the way damage is calculated during fight	
AttackEvaluator.HitCritical.calculateDamage = function(virtualActive, virtualPassive, attackEntry) {////Changed because SRPG calculate counterattack damage BEFORE the fight so it doesn't take into account the fact the counterAttacker is supposed to have already lost HP
		var trueHitValue = 0;
		
		if (this._skill !== null) {
			trueHitValue = this._skill.getSkillValue();
		}
		
		if (DamageCalculator.isHpMinimum(virtualActive.unitSelf, virtualPassive.unitSelf, virtualActive.weapon, attackEntry.isCritical, trueHitValue)) {
			// The opponent HP will be 1 if the attack hits in a way of turning the value of current HP-1 into damage. 
			return virtualPassive.hp - 1;
		}
		
		if (DamageCalculator.isFinish(virtualActive.unitSelf, virtualPassive.unitSelf, virtualActive.weapon, attackEntry.isCritical, trueHitValue)) {
			return virtualPassive.hp;
		}
		if(!virtualActive.isInitiative){////If I'm doing a counterAttack, I call the function that will predict my Hp lost before I calculte my own damage
			return DamageCalculator.calculateDamageCounterAttack(virtualActive.unitSelf, virtualPassive.unitSelf, virtualActive.weapon, attackEntry.isCritical, virtualActive.totalStatus, virtualPassive.totalStatus, trueHitValue);
		}
		else{
			return DamageCalculator.calculateDamage(virtualActive.unitSelf, virtualPassive.unitSelf, virtualActive.weapon, attackEntry.isCritical, virtualActive.totalStatus, virtualPassive.totalStatus, trueHitValue);
		}
		
	};



////change the preview of an attack so we can know the retaliation damage we'll take, taking into account the fact our target will have reduced HP and thus deal less damage
var PosAttackWindow = defineObject(PosBaseWindow,
{
	_statusArray: null,
	_roundAttackCount: 0,
	
	setPosTarget: function(unit, item, targetUnit, targetItem, isSrc) {
		var isCalculation = false;
		
		if (item !== null && item.isWeapon()) {
			if (isSrc) {
				// If the player has launched an attack, the status can be obtained without conditions.
				this._statusArray = AttackChecker.getAttackStatusInternal(unit, item, targetUnit,false);////adding a boolean so know if we're calculating a counterattack
				isCalculation = true;
			}
			else {
				if (AttackChecker.isCounterattack(targetUnit, unit)) {
					this._statusArray = AttackChecker.getAttackStatusInternal(unit, item, targetUnit,true);////adding a boolean so know if we're calculating a counterattack
					isCalculation = true;
				}
				else {
					this._statusArray = AttackChecker.getNonStatus();	
				}
			}
		}
		else {
			this._statusArray = AttackChecker.getNonStatus();
		}
		
		if (isCalculation) {
			this._roundAttackCount = Calculator.calculateRoundCount(unit, targetUnit, item);
			this._roundAttackCount *= Calculator.calculateAttackCount(unit, targetUnit, item);
		}
		else {
			this._roundAttackCount = 0;
		}
		
		this.setPosInfo(unit, item, isSrc);		
	},
	
	drawInfo: function(xBase, yBase) {
		var textui, color, font, pic, x, y, text;
		
		PosBaseWindow.drawInfo.call(this, xBase, yBase);
		
		if (this._roundAttackCount < 2) {
			return;
		}
		
		textui = root.queryTextUI('attacknumber_title');
		color = textui.getColor();
		font = textui.getFont();
		pic = textui.getUIImage();
		x = xBase + 10;
		y = yBase + this.getWindowHeight() - 40;
		text = StringTable.AttackMenu_AttackCount + StringTable.SignWord_Multiple + this._roundAttackCount;
		TextRenderer.drawFixedTitleText(x, y, text, color, font, TextFormat.CENTER, pic, 4);
	},
	
	drawInfoBottom: function(xBase, yBase) {
		var x = xBase;
		var y = yBase + 90;
		var textui = this.getWindowTextUI();
		var color = ColorValue.KEYWORD;
		var font = textui.getFont();
		
		StatusRenderer.drawAttackStatus(x, y, this._statusArray, color, font, 20);
	}
}
);
/////adding a boolean isACounterAttack in function signature so we know if we're calculating a counterattack during fights
AttackChecker.getAttackStatusInternal= function(unit, weapon, targetUnit,isACounterAttack) {
		var activeTotalStatus, passiveTotalStatus;
		var arr = [,,,];
		
		if (weapon === null) {
			return this.getNonStatus();
		}
		
		activeTotalStatus = SupportCalculator.createTotalStatus(unit);
		passiveTotalStatus = SupportCalculator.createTotalStatus(targetUnit);
		if(!isACounterAttack){
			arr[0] = DamageCalculator.calculateDamage(unit, targetUnit, weapon, false, activeTotalStatus, passiveTotalStatus, 0);
		}else{
			arr[0] = DamageCalculator.calculateDamageCounterAttack(unit, targetUnit, weapon, false, activeTotalStatus, passiveTotalStatus, 0);////The attack is a counterAttack so we have to take into account the unit doing the counterattack will have reduced HP cause it was hit before
		}
		arr[1] = HitCalculator.calculateHit(unit, targetUnit, weapon, activeTotalStatus, passiveTotalStatus);
		arr[2] = CriticalCalculator.calculateCritical(unit, targetUnit, weapon, activeTotalStatus, passiveTotalStatus);

		return arr;
	};
	////change the user interface during fight, taking into account reduced retalation damage because of loss of HP
	UIBattleLayout._getAttackStatus= function(unit, targetUnit, isSrc) {
		var arr, isCounterattack;
		
		if (isSrc) {
			arr = AttackChecker.getAttackStatusInternal(unit, BattlerChecker.getRealBattleWeapon(unit), targetUnit);
		}
		else {
			isCounterattack = this._realBattle.getAttackInfo().isCounterattack;
			if (isCounterattack) {
				arr = AttackChecker.getAttackStatusInternal(targetUnit, BattlerChecker.getRealBattleWeapon(targetUnit), unit,isCounterattack);////added isCounterattack when calling getAttackStatusInternal
			}
			else {
				arr = AttackChecker.getNonStatus();
			}
		}
		
		return arr;
	};
