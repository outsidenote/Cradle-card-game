import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// --- Helper Functions and Constants ---

const getRankValue = (card) => {
  // Guard against null card object
  if (!card) return 0;
  const rank = card.rank;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 1;
  return parseInt(rank, 10);
};

const SUIT_ORDER = { 'Clubs': 0, 'Diamonds': 1, 'Hearts': 2, 'Spades': 3 };
const RANK_SORT_ORDER = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const shuffle = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const createAndSortDeck = () => {
  const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const suitSymbols = { Spades: '♠', Diamonds: '♦', Clubs: '♣', Hearts: '♥' };
  const fullDeck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      fullDeck.push({
        id: `${rank}-of-${suit}`,
        suit,
        rank,
        symbol: suitSymbols[suit],
        color: (suit === 'Diamonds' || suit === 'Hearts') ? 'red' : 'black',
        isFaceUp: false,
      });
    }
  }
  const piles = {
    twosThrees: fullDeck.filter(c => ['2', '3'].includes(c.rank)),
    foursSixes: fullDeck.filter(c => ['4', '5', '6'].includes(c.rank)),
    sevensTens: fullDeck.filter(c => ['7', '8', '9', '10'].includes(c.rank)),
    faceCards: fullDeck.filter(c => ['J', 'Q', 'K'].includes(c.rank)),
    aces: fullDeck.filter(c => c.rank === 'A'),
  };
  return piles;
};

const DialogComponent = ({ dialog, onClose }) => {
  const dialogRef = useRef();

  useEffect(() => {
    if (dialog) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [dialog]);

  if (!dialog) return null;

  const handleClose = (wasConfirmed) => {
    onClose(wasConfirmed);
  };

  return (
    <dialog ref={dialogRef} onClose={() => handleClose(false)} className="game-dialog">
      <h3 className="dialog-title">{dialog.title}</h3>
      <div className="dialog-message">{dialog.message}</div>
      <div className="dialog-actions">
        {dialog.type === 'confirm' && (
          <button className="action-button secondary" onClick={() => handleClose(false)}>
            Cancel
          </button>
        )}
        <button className="action-button" onClick={() => handleClose(true)}>
          {dialog.type === 'confirm' ? 'Confirm' : 'OK'}
        </button>
      </div>
    </dialog>
  );
};

const CardComponent = ({ card, onClick, className = '', isSelected, isBonusTarget }) => {
  if (!card) return <div className="card-placeholder" />;
  const cardClasses = `card ${className} ${isSelected ? 'selected' : ''} ${isBonusTarget ? 'bonus-target' : ''}`;
  
  if (!card.isFaceUp) { 
    return (
      <div className={`${cardClasses} card-back`} onClick={onClick}>
        <div className="faint-text">
          {card.rank}{card.symbol}
        </div>
      </div>
    ); 
  }

  return ( <div className={cardClasses} style={{ color: card.color }} onClick={onClick}> <div className="card-rank-suit top">{card.rank}{card.symbol}</div> <div className="card-suit-big">{card.symbol}</div> <div className="card-rank-suit bottom">{card.rank}{card.symbol}</div> </div> );
};


function App() {
  const [gameState, setGameState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [gamePhase, setGamePhase] = useState('attack');
  const [bonusOptions, setBonusOptions] = useState({ cardIds: [], targetPlayerId: null });
  const [wasAttackAutoSkipped, setWasAttackAutoSkipped] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [purchaseBonus, setPurchaseBonus] = useState(null);

  const initializeGame = useCallback(() => {
    setIsLoading(true);
    setSelectedCardIds([]);
    setGamePhase('attack');
    setBonusOptions({ cardIds: [], targetPlayerId: null });
    setWasAttackAutoSkipped(false);
    setPurchaseBonus(null);

    const piles = createAndSortDeck();
    Object.values(piles).forEach(pile => shuffle(pile));
    const playerVillages = [piles.twosThrees.splice(0, 4), piles.twosThrees.splice(0, 4)];
    playerVillages.forEach(village => village.forEach(card => card.isFaceUp = true));
    const centralDeck = [ ...piles.foursSixes, ...piles.sevensTens, ...piles.faceCards ];
    piles.aces.forEach(card => card.isFaceUp = true);
    const purchaseRow = centralDeck.splice(0, 4);
    purchaseRow.forEach(card => card.isFaceUp = true);
    const p1Twos = playerVillages[0].filter(c => c.rank === '2').length;
    const p2Twos = playerVillages[1].filter(c => c.rank === '2').length;
    const currentPlayerIndex = p1Twos >= p2Twos ? 0 : 1;
    
    setGameState({
      players: [
        { id: 1, name: 'Player 1', village: playerVillages[0] },
        { id: 2, name: 'Player 2', village: playerVillages[1] },
      ],
      centralDeck, purchaseRow, aces: piles.aces, currentPlayerIndex, turn: 1,
    });
    setIsLoading(false);
  }, []);

  const endTurn = (currentState) => {
    let newState = JSON.parse(JSON.stringify(currentState));
    const nextPlayerIndex = (newState.currentPlayerIndex + 1) % 2;
    newState.currentPlayerIndex = nextPlayerIndex;
    if (nextPlayerIndex === 0) {
      newState.turn += 1;
    }
    setGamePhase('attack');
    setSelectedCardIds([]);
    setBonusOptions({ cardIds: [], targetPlayerId: null });
    setWasAttackAutoSkipped(false);
    setPurchaseBonus(null);
    return newState;
  };

  const handleSelectVillageCard = (cardId) => {
    if (!gameState) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const card = currentPlayer.village.find(c => c.id === cardId);

    if (gamePhase === 'attack' && card.suit !== 'Spades') {
        return;
    }
    
    if (gamePhase === 'attack' || (gamePhase === 'purchase' && card.isFaceUp)) {
      setSelectedCardIds(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]);
    }
  };

  const handleAttack = () => {
    setGameState(prevState => {
      let newState = JSON.parse(JSON.stringify(prevState));
      const attacker = newState.players[newState.currentPlayerIndex];
      const defender = newState.players[(newState.currentPlayerIndex + 1) % 2];
      
      const attackingCards = attacker.village.filter(c => selectedCardIds.includes(c.id));
      const attackPower = attackingCards.reduce((sum, card) => sum + getRankValue(card), 0);
      
      const defendingSpades = defender.village.filter(c => c.isFaceUp && c.suit === 'Spades');
      const defensePower = defendingSpades.reduce((sum, card) => sum + getRankValue(card), 0);

      if (attackPower > defensePower) {
        const weakenTargets = defender.village.filter(c => c.isFaceUp);
        if (weakenTargets.length > 0) {
          setDialog({ title: "Attack Succeeded!", message: "Select an opponent's face-up card to weaken and gain its power for your purchase." });
          attackingCards.forEach(card => {
            const cardInVillage = attacker.village.find(c => c.id === card.id);
            if (cardInVillage) cardInVillage.isFaceUp = false;
          });
          setGamePhase('weaken_opponent');
          setBonusOptions({
              cardIds: weakenTargets.map(c => c.id),
              targetPlayerId: defender.id
          });
        } else {
          setDialog({ title: "Attack Succeeded!", message: "The opponent has no face-up cards to weaken. Moving to purchase phase." });
          setGamePhase('purchase');
        }
      } else {
        setDialog({ title: "Attack Failed", message: "The opponent's defense was too strong. Moving to purchase phase." });
        setGamePhase('purchase');
      }
      
      setSelectedCardIds([]);
      return newState;
    });
  };
  
  const handleSkipAttack = () => {
    setGamePhase('purchase');
    setSelectedCardIds([]);
  }

  const handleWeakenOpponentCard = (cardToWeakenId, targetPlayerId) => {
    setGameState(prevState => {
        let newState = JSON.parse(JSON.stringify(prevState));
        const defender = newState.players.find(p => p.id === targetPlayerId);
        const cardToWeaken = defender.village.find(c => c.id === cardToWeakenId);

        if (!cardToWeaken) return prevState;
        
        cardToWeaken.isFaceUp = false;
        setPurchaseBonus(cardToWeaken);

        setGamePhase('purchase');
        setBonusOptions({ cardIds: [], targetPlayerId: null });
        setDialog({ title: "Bonus Gained!", message: `You gained the power of the ${cardToWeaken.rank} of ${cardToWeaken.suit} for this purchase phase.`});
        return newState;
    });
  };

  const handlePurchase = (cardToBuy, indexInRow) => {
    if (selectedCardIds.length === 0) {
      setDialog({ title: "Selection Required", message: "Please select card(s) from your village to pay or a single card to upgrade." });
      return;
    }
  
    const performPurchase = (isConfirmed = true) => {
      if (!isConfirmed) return;
  
      setGameState(prevState => {
        let newState = JSON.parse(JSON.stringify(prevState));
        const currentPlayer = newState.players[newState.currentPlayerIndex];
        
        const paymentCardIds = [...selectedCardIds];
        const selectedCards = currentPlayer.village.filter(c => paymentCardIds.includes(c.id));
        
        const matchingSuitCards = selectedCards.filter(c => c.suit === cardToBuy.suit);
        const purchaseRow = newState.purchaseRow;
        const isAdjacentSameSuit = (purchaseRow[indexInRow - 1]?.suit === cardToBuy.suit) || (purchaseRow[indexInRow + 1]?.suit === cardToBuy.suit);
        
        const isUpgradeAttempt = matchingSuitCards.length === 1 && !isAdjacentSameSuit;
  
        if (isUpgradeAttempt) {
            const upgradeCard = matchingSuitCards[0];
            const otherPaymentCards = selectedCards.filter(c => c.id !== upgradeCard.id);
            
            currentPlayer.village = currentPlayer.village.filter(c => c.id !== upgradeCard.id);
            otherPaymentCards.forEach(pCard => {
                const cardInVillage = currentPlayer.village.find(c => c.id === pCard.id);
                if(cardInVillage) cardInVillage.isFaceUp = false;
            });
            currentPlayer.village.push({ ...cardToBuy, isFaceUp: false });
        } 
        else {
            selectedCards.forEach(card => {
                const cardInVillage = currentPlayer.village.find(c => c.id === card.id);
                if (cardInVillage) cardInVillage.isFaceUp = false;
            });
            currentPlayer.village.push({ ...cardToBuy, isFaceUp: false });
        }
  
        newState.purchaseRow.splice(indexInRow, 1);
        if (newState.centralDeck.length > 0) {
            const deckCard = newState.centralDeck.pop();
            deckCard.isFaceUp = true;
            newState.purchaseRow.push(deckCard);
        }
        setSelectedCardIds([]);
  
        if (cardToBuy.suit === 'Hearts') {
            const newCardId = cardToBuy.id;
            const eligibleBonusCards = currentPlayer.village.filter(c => 
                !c.isFaceUp && c.id !== newCardId && !paymentCardIds.includes(c.id) 
            );
  
            if (eligibleBonusCards.length > 0) {
                setGamePhase('heart_bonus');
                setBonusOptions({ cardIds: eligibleBonusCards.map(c => c.id), targetPlayerId: null });
                return newState;
            }
        }
        return endTurn(newState);
      });
    };
  
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const cost = getRankValue(cardToBuy);
    const selectedCards = currentPlayer.village.filter(c => selectedCardIds.includes(c.id));
    const matchingSuitCards = selectedCards.filter(c => c.suit === cardToBuy.suit);
    const purchaseRow = gameState.purchaseRow;
    const isAdjacentSameSuit = (purchaseRow[indexInRow - 1]?.suit === cardToBuy.suit) || (purchaseRow[indexInRow + 1]?.suit === cardToBuy.suit);
    const isUpgradeAttempt = matchingSuitCards.length === 1 && !isAdjacentSameSuit;
    
    let attackBonusValue = 0;
    if (purchaseBonus) {
        attackBonusValue += getRankValue(purchaseBonus);
        if ((cardToBuy.color === 'red' && purchaseBonus.suit === 'Diamonds') || (cardToBuy.color === 'black' && purchaseBonus.suit === 'Clubs')) {
            attackBonusValue += 2;
        }
    }
  
    if (isUpgradeAttempt) {
      const upgradeCard = matchingSuitCards[0];
      const otherPaymentCards = selectedCards.filter(c => c.id !== upgradeCard.id);
      let upgradeValue = getRankValue(upgradeCard);
      if (upgradeCard.rank === '2') upgradeValue = 3;
      const paymentValue = otherPaymentCards.reduce((sum, pc) => sum + getRankValue(pc), 0);
      const totalValue = upgradeValue + paymentValue + attackBonusValue;
  
      if (totalValue < cost) {
        setDialog({ title: "Insufficient Value", message: `Your total offer value of ${totalValue} (including bonus) is not enough for the card costing ${cost}.` });
        return;
      }
  
      setDialog({
        type: 'confirm',
        title: 'Confirm Upgrade',
        message: `Upgrade with ${upgradeCard.rank} of ${upgradeCard.suit} and pay with ${otherPaymentCards.length} other card(s)?\n\nThe ${upgradeCard.rank} of ${upgradeCard.suit} will be discarded.`,
        onConfirm: () => performPurchase(true)
      });
    } else {
      if (matchingSuitCards.length > 1) {
        setDialog({ title: "Standard Purchase", message: "You cannot upgrade with more than one card of the matching suit. This will be a standard purchase." });
      }
      if (matchingSuitCards.length === 1 && isAdjacentSameSuit) {
        setDialog({ title: "Standard Purchase", message: `You cannot upgrade a ${cardToBuy.suit} when it is adjacent to another ${cardToBuy.suit}. This will be a standard purchase.` });
      }
      const paymentTotal = selectedCards.reduce((sum, pc) => sum + getRankValue(pc) + ((cardToBuy.color === 'red' && pc.suit === 'Diamonds') || (cardToBuy.color === 'black' && pc.suit === 'Clubs') ? 2 : 0), 0);
      const grandTotal = paymentTotal + attackBonusValue;

      if (grandTotal < cost) {
        setDialog({ title: "Insufficient Value", message: `Cost is ${cost}, but you only offered ${grandTotal} (including bonus).` });
        return;
      }
      performPurchase(true);
    }
  };

  const handleHeartBonus = (cardToFlipId) => {
    setGameState(prevState => {
      let newState = JSON.parse(JSON.stringify(prevState));
      const cardInVillage = newState.players[newState.currentPlayerIndex].village.find(c => c.id === cardToFlipId);
      if (cardInVillage) cardInVillage.isFaceUp = true;
      setBonusOptions({ cardIds: [], targetPlayerId: null });
      return endTurn(newState);
    });
  };

  const performRestAndEndTurn = () => {
    setGameState(prevState => {
      if (!prevState) return null;
      let newState = JSON.parse(JSON.stringify(prevState));
      newState.players[newState.currentPlayerIndex].village.forEach(card => { card.isFaceUp = true; });
      return endTurn(newState);
    });
  };

  const handleRest = () => {
    performRestAndEndTurn();
    setSelectedCardIds([]);
  };

  const handleDialogClose = (wasConfirmed) => {
    if (wasConfirmed && dialog.onConfirm) {
      dialog.onConfirm();
    }
    setDialog(null);
  };

  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  useEffect(() => {
    if (isLoading || !gameState || gamePhase !== 'attack') return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const opponentPlayer = gameState.players[(gameState.currentPlayerIndex + 1) % 2];
    const currentPlayerSpadesRank = currentPlayer.village.filter(c => c.isFaceUp && c.suit === 'Spades').reduce((sum, card) => sum + getRankValue(card), 0);
    const opponentSpadesRank = opponentPlayer.village.filter(c => c.isFaceUp && c.suit === 'Spades').reduce((sum, card) => sum + getRankValue(card), 0);

    if (currentPlayerSpadesRank <= opponentSpadesRank) {
      setDialog({ title: "Attack Skipped", message: `${currentPlayer.name}'s total Spades rank (${currentPlayerSpadesRank}) is not greater than the opponent's (${opponentSpadesRank}).` });
      setWasAttackAutoSkipped(true);
      setGamePhase('purchase');
    }
  }, [gameState, isLoading, gamePhase]);

  // --- FIXED: Guard added to prevent crash when purchaseBonus is null ---
  useEffect(() => {
    if (isLoading || !gameState || gamePhase !== 'purchase') return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const faceUpCards = currentPlayer.village.filter(card => card.isFaceUp);

    const bonusValue = purchaseBonus ? getRankValue(purchaseBonus) : 0;
    const maxPayment = faceUpCards.reduce((sum, card) => sum + getRankValue(card), 0) + bonusValue;
    
    if (gameState.purchaseRow.length === 0) return;
    const minCost = Math.min(...gameState.purchaseRow.map(card => getRankValue(card)));
    
    if (maxPayment < minCost && !wasAttackAutoSkipped) {
      setDialog({ title: "Auto-Rest", message: `${currentPlayer.name} has no available moves and automatically rests.` });
      performRestAndEndTurn();
    }
  }, [gameState, isLoading, gamePhase, wasAttackAutoSkipped, purchaseBonus, performRestAndEndTurn]);


  if (isLoading || !gameState) {
    return <div className="game-board"><h1>Setting up the Cradle...</h1></div>;
  }

  const { players, purchaseRow, centralDeck, aces, currentPlayerIndex } = gameState;

  return (
    <div className="game-board">
      <DialogComponent dialog={dialog} onClose={handleDialogClose} />
      <header className="game-header">
        <div className="title-and-restart">
            <h1>Cradle</h1>
            <button onClick={initializeGame} className="action-button restart-button">Restart Game</button>
        </div>
        <h2>Turn {gameState.turn}: {players[currentPlayerIndex].name}'s Turn</h2>
        {gamePhase === 'heart_bonus' && <h3 className="game-phase-indicator">HEARTS BONUS: Select a face-down card to recover.</h3>}
        {gamePhase === 'weaken_opponent' && <h3 className="game-phase-indicator">ATTACK SUCCESS: Select an opponent's card to weaken.</h3>}
      </header>

      <div className="table-top">
        <div className="purchase-area">
          <h3>Purchase Row</h3>
          <div className="card-row">
            {purchaseRow.map((card, index) => (
              <CardComponent key={card.id || index} card={card} onClick={gamePhase === 'purchase' ? () => handlePurchase(card, index) : undefined}/>
            ))}
          </div>
        </div>
        <div className="decks-area">
          <div className="deck-pile"><h3>Central Deck</h3><CardComponent card={{ isFaceUp: false, rank: '', symbol: '' }} /><p>{centralDeck.length} cards left</p></div>
          <div className="deck-pile"><h3>Aces</h3><div className="card-row">{aces.map(card => <CardComponent key={card.id} card={card} />)}</div></div>
        </div>
      </div>
      <hr />
      <div className="players-section">
        {players.map((player, index) => {
          const isMyTurn = index === currentPlayerIndex;
          const groupedBySuit = player.village.reduce((acc, card) => {
            acc[card.suit] = acc[card.suit] || [];
            acc[card.suit].push(card);
            return acc;
          }, {});

          for (const suit in groupedBySuit) {
            groupedBySuit[suit].sort((a, b) => RANK_SORT_ORDER[b.rank] - RANK_SORT_ORDER[a.rank]);
          }

          const sortedSuits = Object.keys(groupedBySuit).sort((a, b) => SUIT_ORDER[a] - SUIT_ORDER[b]);

          return (
            <div key={player.id} className={`player-area ${isMyTurn ? 'active-player' : ''}`}>
              <div className="player-header">
                <h2>{player.name}'s Village</h2>
                <div className="phase-and-actions">
                  {isMyTurn && gamePhase === 'attack' && (
                    <>
                      <h3 className='phase-text'>Attack Phase</h3>
                      <div className="action-buttons">
                        <button className="action-button" onClick={handleAttack}>Attack!</button>
                        <button className="action-button" onClick={handleSkipAttack}>Skip Attack</button>
                        <button className="action-button" onClick={handleRest}>Rest</button>
                      </div>
                    </>
                  )}
                  {isMyTurn && gamePhase === 'purchase' && (
                    <>
                      <h3 className='phase-text'>Purchase Phase</h3>
                      {purchaseBonus && (
                        <span className="purchase-bonus-text">
                          + {getRankValue(purchaseBonus)} {purchaseBonus.symbol} Bonus!
                        </span>
                      )}
                      {wasAttackAutoSkipped && (
                        <div className="action-buttons">
                          <button className="action-button" onClick={handleRest}>Rest</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="village-columns">
                {sortedSuits.map(suit => (
                  <div key={suit} className="suit-column">
                    <h4>{suit}</h4>
                    <div className="card-stack">
                      {groupedBySuit[suit].map((card, cardIndex) => {
                        let canClick = false, clickHandler = undefined, customClass = '';
                        
                        // --- FIXED: Corrected click handling logic ---
                        if (isMyTurn) {
                            if (gamePhase === 'attack' && card.isFaceUp && card.suit === 'Spades') {
                                canClick = true;
                                clickHandler = () => handleSelectVillageCard(card.id);
                                customClass = 'attack-selectable';
                            } else if (gamePhase === 'purchase' && card.isFaceUp) {
                                canClick = true;
                                clickHandler = () => handleSelectVillageCard(card.id);
                                customClass = 'selectable';
                            } else if (gamePhase === 'heart_bonus' && bonusOptions.cardIds.includes(card.id)) {
                                canClick = true;
                                clickHandler = () => handleHeartBonus(card.id);
                            }
                        } else { // It's the opponent's board
                            if (gamePhase === 'weaken_opponent' && bonusOptions.cardIds.includes(card.id)) {
                                canClick = true;
                                clickHandler = () => handleWeakenOpponentCard(card.id, player.id);
                            }
                        }

                        const isTarget = (gamePhase === 'weaken_opponent' || gamePhase === 'heart_bonus') && bonusOptions.cardIds.includes(card.id);
                        
                        return (
                          <div
                            key={card.id}
                            className="stacked-card-wrapper"
                            style={{ top: `${cardIndex * 35}px`, zIndex: cardIndex }}
                          >
                            <CardComponent 
                              card={card} 
                              isSelected={selectedCardIds.includes(card.id)} 
                              isBonusTarget={isTarget} 
                              onClick={canClick ? clickHandler : undefined} 
                              className={customClass} 
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;