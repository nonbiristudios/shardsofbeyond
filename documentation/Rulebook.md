# Rulebook

## Glossary
### Action:
- _Action text._ -> _Resolving text_
- Deploy UNIT (_that is not in a Slot_). -> Deploy UNIT in a Slot.
- Deploy UNIT (_that is not in a Slot_) in SLOT (_that is empty_). -> _UNIT's position is SLOT._
- Put UNIT into it's owner's Hand. -> _UNIT's positions is owner's Hand._
- Put UNIT on the top/bottom of DECK. -> _UNIT's position is top/bottom of DECK._
- Move UNIT (_in a Slot_) to SLOT (_that is empty_). -> _A Unit's position is SLOT. SLOT is free._
- Swap UNIT (_in a Slot_) with UNIT (_in a Slot_). -> _Both UNIT's positions are swapped._
- Crystallize UNIT (_that is not a Crystal_). -> _A Unit is a Crystal._
- Conquer LANE -> _You control LANE._
- Draw UNIT (_in your Deck_): Draw the top UNIT from your deck.
- Draw top UNIT from your Deck. -> _UNIT is in your Hand._
- Shuffle DECK. _Your Deck is shuffled._
- UNIT gains Taunt. -> Put a Taunt Token on UNIT.
- UNIT gains Fear. -> Put a Fear Token on UNIT.
- Play UNIT (_in your Hand_). -> If your Crystals meet UNIT's requirements, deploy UNIT.
- Gain N Power. -> THIS gains N Power.
- UNIT (_in a Slot_) gains N Power. -> Put N Power Tokens on UNIT.
- Put TOKEN on UNIT. -> Put TOKEN on UNIT (_in a Slot_).
- Put TOKEN on UNIT (_in a Slot/Crystal Zone_&_not buried_). -> _UNIT has a TOKEN._
- Glimpse N. -> Look at the top N Units of your Deck. You may put any Units on the bottom of your Deck.
- Obscure N. -> Look at the top N Units of your Opponent's Deck. You may put any Units on the bottom of your Deck.
- Bury UNIT (_in a Slot_) / CRYSTAL. -> _UNIT/CRYSTAL is buried._
- Unearth UNIT (_in a Slot_) / CRYSTAL. -> _UNIT is not buried._

### Triggers (bound to Units)
- Conquer: ACTION. -> When you conquer this Lane, ACTION.
- Crystallize: ACTION. -> When this gets crystallized, ACTION.
- Unearth: ACTION. -> When this gets unearthed, ACTION.
- Taunt. -> Deploy: This gains Taunt.
- Ascend. -> ASCEND: a Unit.
- Ascend: UNIT. -> You may play UNIT in this Slot. If you do, return this to the bottom of your Deck.
- Start of your Turn: ACTION. -> When your Turn starts, ACTION.
- Ritual. -> Ritual: UNIT.
- Ritual. -> When this gets played, bury this or an adjacent friendly Unit.
- Ambush: ACTION. -> When ACTION is done, unearth this.
- Ally of UNIT: ACTION. -> When this is deployed, put an Ally Token on this. When a friendly UNIT is deployed adjacently, remove an Ally Token from this to ACTION.
- Deploy: ACTION. -> When this gets deployed, ACTION.
- Move: ACTION. -> When this gets moved, ACTION.
- Ward. -> Your Opponent can't bury, crystallize, move, put this anywhere or put Tokens on it.
- Unleash <Crystals>: ACTION. -> If you have <Crystals> Crystals, ACTION.
- Choose one: ACTION1. ACTION2. -> ACTION1 or ACTION2.
- Crystalborn. -> When you crystallize this, put a Crystalborn Token on this.

### Components
- ZONE: Hand, Deck, Crystal Zone, Slots.
- TOKEN: Crystalborn, Taunt, Fear,

### Tokens (on Units)
- Taunt Token: Until your next Turn, if UNIT has adjacent empty Slots, your Opponent can deploy Units only in these Slots.
- Fear Token: Until your next Turn, if there are empty Slots not adjacent to UNIT, your Opponent can't deploy Units adjacent to UNIT.
- Crystalborn Token: You may play this from your Crystal Zone.
