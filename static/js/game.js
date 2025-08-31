let gameState = {
    gamePhase: 'pre-flop', // Possible values: pre-flop, flop, turn, river, showdown
};

function initializeGame(playerCount) {
    gameState = {
        players: [],
        communityCards: [],
        pot: 0,
        dealerButton: 0,
        smallBlind: 10,
        bigBlind: 20,
        currentBet: 0,
        currentPlayerIndex: 0,
        gamePhase: 'pre-flop',
        roundStartPlayerIndex: 0, // Track who started the current betting round
        playersActedInRound: 0, // Count how many players have acted in the current round
    };

    // Initialize the deck and shuffle it
    initGame();

    for (let i = 1; i <= playerCount; i++) {
        gameState.players.push({ name: `玩家${i}`, chips: 1000, hand: [], bet: 0, folded: false, showHand: false, hasActedInRound: false });
    }

    // Determine blinds
    const smallBlindIndex = (gameState.dealerButton + 1) % playerCount;
    const bigBlindIndex = (gameState.dealerButton + 2) % playerCount;

    // Post blinds
    gameState.players[smallBlindIndex].chips -= gameState.smallBlind;
    gameState.players[smallBlindIndex].bet = gameState.smallBlind;
    gameState.players[smallBlindIndex].hasActedInRound = true; // Blinds have acted
    gameState.players[bigBlindIndex].chips -= gameState.bigBlind;
    gameState.players[bigBlindIndex].bet = gameState.bigBlind;
    gameState.players[bigBlindIndex].hasActedInRound = true; // Blinds have acted
    gameState.pot = gameState.smallBlind + gameState.bigBlind;
    gameState.currentBet = gameState.bigBlind;

    // Set current player to the one after big blind
    gameState.currentPlayerIndex = (bigBlindIndex + 1) % playerCount;
    gameState.roundStartPlayerIndex = gameState.currentPlayerIndex; // First player to act in pre-flop

    dealInitialCards();
}

// Initialize the game
function initGame() {
    // Create a standard deck of 52 cards
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];
    
    gameState.deck = [];
    for (let suit of suits) {
        for (let value of values) {
            gameState.deck.push({ suit, value });
        }
    }
    // 确保牌组中只有52张牌，移除大小王
    gameState.deck = gameState.deck.filter(card => card.value !== 'joker_a' && card.value !== 'joker_b');
    
    // Shuffle the deck
    shuffleDeck();
    

}

// Shuffle the deck using Fisher-Yates algorithm
function shuffleDeck() {
    for (let i = gameState.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
    }
}

// Draw a card from the deck
function drawCard() {
    if (gameState.deck.length === 0) {
        console.error('Deck is empty!');
        return null;
    }
    return gameState.deck.pop();
}

function dealInitialCards() {
    // Reset hands for all players
    gameState.players.forEach(player => {
        player.hand = [];
    });

    // Deal 2 cards to each player
    for (let i = 0; i < 2; i++) {
        gameState.players.forEach(player => {
            player.hand.push(drawCard());
        });
    }
}

// Create a card HTML element
function createCardElement(card, show = true) {
    const cardDiv = document.createElement('div');
    cardDiv.classList.add('card');
    if (show) {
        cardDiv.style.backgroundImage = `url('${getCardImagePath(card)}')`;
    } else {
        cardDiv.style.backgroundImage = `url('../static/images/cards/card_back.png')`; // Path to card back image
    }
    cardDiv.style.backgroundSize = 'contain';
    cardDiv.style.backgroundRepeat = 'no-repeat';
    cardDiv.style.backgroundColor = 'transparent';
    return cardDiv;
}

// Get card image path
function getCardImagePath(card) {
    return `../static/images/cards/${card.value}_of_${card.suit}.png`;
}

// Update the UI based on game state
function updateUI() {
    const playersDiv = document.querySelector('.players');
    playersDiv.innerHTML = ''; // Clear existing player cards

    gameState.players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.classList.add('player');
        // Add a data attribute for player ID to easily select them later
        playerDiv.dataset.playerId = player.id; 
        playerDiv.innerHTML = `<h3>${player.name} (筹码: ${player.chips}, 下注: ${player.bet})</h3>`;
        
        const handDiv = document.createElement('div');
        handDiv.classList.add('hand');
        if (!player.showHand) {
            handDiv.style.display = 'none';
        }
        player.hand.forEach(card => {
            handDiv.appendChild(createCardElement(card, player.showHand));
        });
        playerDiv.appendChild(handDiv);
        playersDiv.appendChild(playerDiv);
    });

    const communityCardsDiv = document.querySelector('.community-cards');
    communityCardsDiv.innerHTML = ''; // Clear existing community cards
    gameState.communityCards.forEach(card => {
        communityCardsDiv.appendChild(createCardElement(card));
    });

    const scoreboard = document.querySelector('.scoreboard');
    scoreboard.innerHTML = `
        <p>底池: ${gameState.pot}</p>
        <p>当前下注: ${gameState.currentBet}</p>
        <p>当前玩家: ${gameState.players[gameState.currentPlayerIndex].name}</p>
        <p>阶段: ${gameState.gamePhase}</p>
    `;

    // Update action buttons visibility
    const player = gameState.players[gameState.currentPlayerIndex];
    const checkBtn = document.getElementById('check');
    const callBtn = document.getElementById('call');
    const raiseContainer = document.querySelector('.raise-container');
    const raiseAmountInput = document.getElementById('raise-amount');

    // If current bet is 0 (start of a new betting round or all checked)
    if (gameState.currentBet === 0) {
        checkBtn.style.display = 'inline-block';
        callBtn.style.display = 'none';
    } else {
        // If player's bet matches current bet, they can check (if no one raised after them)
        if (player.bet === gameState.currentBet) {
            checkBtn.style.display = 'inline-block';
            callBtn.style.display = 'none';
        } else {
            // Player needs to call or raise
            checkBtn.style.display = 'none';
            callBtn.style.display = 'inline-block';
            callBtn.textContent = `跟注 (${gameState.currentBet - player.bet})`;
        }
    }
    raiseContainer.style.display = 'inline-block'; // Always show raise for now
    raiseAmountInput.value = ''; // Clear raise amount input

    console.log('Updating UI with current game state:', gameState);
}

// Player actions
function fold() {
    gameState.players[gameState.currentPlayerIndex].folded = true;
    gameState.players[gameState.currentPlayerIndex].hasActedIn_round = true;

    // 检查是否只剩一个玩家未弃牌
    const activePlayers = gameState.players.filter(player => !player.folded);
    if (activePlayers.length === 1) {
        endRoundEarly(activePlayers[0]);
        return; // 提前结束，不再进行nextPlayer
    }

    nextPlayer();
}

function check() {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (player.bet === gameState.currentBet) {
        player.hasActedInRound = true;
        nextPlayer();
    } else {
        alert("你不能过牌，必须跟注或加注。");
    }
}

function call() {
    const player = gameState.players[gameState.currentPlayerIndex];
    const callAmount = gameState.currentBet - player.bet;
    
    if (player.chips < callAmount) {
        alert("筹码不足，无法跟注。");
        return;
    }

    player.chips -= callAmount;
    player.bet = gameState.currentBet; // Player's bet matches current bet
    gameState.pot += callAmount;
    player.hasActedInRound = true;
    
    nextPlayer();
}

function raise() {
    const raiseAmountInput = document.getElementById('raise-amount');
    const amount = parseInt(raiseAmountInput.value);

    if (isNaN(amount) || amount <= 0) {
        alert("请输入有效的加注金额。");
        return;
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    const currentBetForPlayer = player.bet;
    const amountToCall = gameState.currentBet - currentBetForPlayer;
    const totalBetRequired = amountToCall + amount; // Total chips player needs to put in

    if (player.chips < totalBetRequired) {
        alert("你的筹码不足以加注这么多。");
        return;
    }
    
    player.chips -= totalBetRequired;
    player.bet = gameState.currentBet + amount; // Player's new total bet
    gameState.pot += totalBetRequired;
    gameState.currentBet = player.bet; // Update current bet to the new higher bet

    // Reset hasActedInRound for all players who have already acted in this round
    // This forces them to act again if they want to continue
    gameState.players.forEach(p => {
        if (p.id !== player.id) { // Don't reset for the current player
            p.hasActedInRound = false;
        }
    });
    player.hasActedInRound = true; // Current player has acted

    raiseAmountInput.value = '';
    nextPlayer();
}

function nextPlayer() {
    let nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    let playersChecked = 0; // Counter for players who have checked in a row

    // Loop to find the next active player
    while (true) {
        const nextPlayer = gameState.players[nextPlayerIndex];

        // If all active players have acted and their bets match, round is over
        if (isBettingRoundOver()) {
            endBettingRound();
            return;
        }

        // Skip folded players
        if (nextPlayer.folded) {
            nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
            continue;
        }

        // If the next player has already acted in this round and their bet matches the current bet
        // and they are not the one who started the round (unless everyone else has acted)
        if (nextPlayer.hasActedInRound && nextPlayer.bet === gameState.currentBet) {
            // This player has already acted and matched the bet, skip them unless they are the last to act
            // and everyone else has also acted and matched.
            const activePlayers = gameState.players.filter(p => !p.folded);
            const allActivePlayersActed = activePlayers.every(p => p.hasActedInRound);
            const allActivePlayersMatchedBet = activePlayers.every(p => p.bet === gameState.currentBet);

            if (allActivePlayersActed && allActivePlayersMatchedBet) {
                endBettingRound();
                return;
            }
            nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
            continue;
        }

        // If we reach here, this is the next player to act
        gameState.currentPlayerIndex = nextPlayerIndex;
        updateUI();
        return;
    }
}

function isBettingRoundOver() {
    const activePlayers = gameState.players.filter(p => !p.folded);
    if (activePlayers.length <= 1) {
        return true; // Only one player left, round is over
    }

    // Check if all active players have acted in this round
    const allActivePlayersActed = activePlayers.every(p => p.hasActedInRound);

    // Check if all active players have matched the current bet
    const allActivePlayersMatchedBet = activePlayers.every(p => p.bet === gameState.currentBet);

    // If all active players have acted AND all active players have matched the current bet
    return allActivePlayersActed && allActivePlayersMatchedBet;
}

function endBettingRound() {
    // Reset bets for the next round and hasActedInRound status
    gameState.players.forEach(p => {
        p.bet = 0;
        p.hasActedInRound = false;
    });
    gameState.currentBet = 0;
    gameState.playersActedInRound = 0; // Reset counter

    // Set the first player to act in the next round (player after dealer button)
    gameState.currentPlayerIndex = (gameState.dealerButton + 1) % gameState.players.length;
    gameState.roundStartPlayerIndex = gameState.currentPlayerIndex;

    // Skip folded players to find the actual first player to act
    while (gameState.players[gameState.currentPlayerIndex].folded) {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        gameState.roundStartPlayerIndex = gameState.currentPlayerIndex; // Update round start player if skipped
    }

    switch (gameState.gamePhase) {
        case 'pre-flop':
            gameState.gamePhase = 'flop';
            dealCommunityCards(3);
            break;
        case 'flop':
            gameState.gamePhase = 'turn';
            dealCommunityCards(1);
            break;
        case 'turn':
            gameState.gamePhase = 'river';
            dealCommunityCards(1);
            break;
        case 'river':
            gameState.gamePhase = 'showdown';
            showdown();
            break;
    }
    updateUI();
}

function dealCommunityCards(count) {
    for (let i = 0; i < count; i++) {
        gameState.communityCards.push(drawCard());
    }
}

// Helper function to convert card value string to a numerical rank
function getCardRank(cardValue) {
    const ranks = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
        'jack': 11, 'queen': 12, 'king': 13, 'ace': 14
    };
    return ranks[cardValue.toLowerCase()];
}

// Function to compare two best hands (5 cards each) for tie-breaking
// Returns 1 if hand1 is better, -1 if hand2 is better, 0 if truly tied
function compareBestHands(hand1Cards, hand2Cards) {
    // Sort cards by rank in descending order
    const sortedHand1 = hand1Cards.map(card => getCardRank(card.value)).sort((a, b) => b - a);
    const sortedHand2 = hand2Cards.map(card => getCardRank(card.value)).sort((a, b) => b - a);

    for (let i = 0; i < sortedHand1.length; i++) {
        if (sortedHand1[i] > sortedHand2[i]) {
            return 1; // hand1 is better
        } else if (sortedHand1[i] < sortedHand2[i]) {
            return -1; // hand2 is better
        }
    }
    return 0; // Hands are exactly tied
}

function showdown() {
    const playersInHand = gameState.players.filter(p => !p.folded);
    if (playersInHand.length === 1) {
        const winner = playersInHand[0];
        winner.chips += gameState.pot;
        alert(`${winner.name} 赢得了底池 ${gameState.pot} 筹码！`);
        resetGameForNextHand();
        return;
    }

    let winners = [];
    let bestHandResult = null;

    for (const player of playersInHand) {
        const playerHandResult = PokerEvaluator.evaluateHand(player.hand, gameState.communityCards);
        player.bestHand = playerHandResult; // Store for display

        if (!bestHandResult || playerHandResult.value > bestHandResult.value) {
            bestHandResult = playerHandResult;
            winners = [player];
        } else if (playerHandResult.value === bestHandResult.value) {
            // Compare hands using custom logic for tie-breaking
            // Use PokerEvaluator.breakTie for detailed tie-breaking
            const tieResult = PokerEvaluator.breakTie(playerHandResult.bestHand, bestHandResult.bestHand);
            if (tieResult === 1) {
                bestHandResult = playerHandResult; // New player has a better hand (e.g., higher kicker)
                winners = [player];
            } else if (tieResult === 0) {
                winners.push(player); // Truly tied, add to winners
            }
            // If tieResult is -1, current winner is better, do nothing
        }
    }

    // Distribute pot among winners
    const potPerWinner = Math.floor(gameState.pot / winners.length);
    let winnerMessage = '赢家：\n';
    for (const winner of winners) {
        winner.chips += potPerWinner;
        winnerMessage += `${winner.name} 凭借 ${winner.bestHand.rank} 牌型赢得了 ${potPerWinner} 筹码！\n`;
    }
    alert(winnerMessage);
    
    // Create and show a modal for reviewing all players' hands
    const reviewModal = document.createElement('div');
    reviewModal.id = 'review-modal';
    reviewModal.style.position = 'fixed';
    reviewModal.style.top = '0';
    reviewModal.style.left = '0';
    reviewModal.style.width = '100%';
    reviewModal.style.height = '100%';
    reviewModal.style.backgroundColor = 'rgba(0,0,0,0.8)'; // 更深的背景，突出内容
    reviewModal.style.display = 'flex';
    reviewModal.style.flexDirection = 'column';
    reviewModal.style.alignItems = 'center';
    reviewModal.style.justifyContent = 'flex-start'; // 顶部对齐
    reviewModal.style.zIndex = '1000';
    reviewModal.style.padding = '20px';
    reviewModal.style.boxSizing = 'border-box';
    reviewModal.style.overflowY = 'auto'; // 允许垂直滚动
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = '本局牌型回顾';
    title.style.color = 'white';
    title.style.marginBottom = '20px';
    reviewModal.appendChild(title);
    
    // Add community cards
    const communityCardsReviewDiv = document.createElement('div');
    communityCardsReviewDiv.style.margin = '20px';
    communityCardsReviewDiv.style.textAlign = 'center';
    const communityTitle = document.createElement('h3');
    communityTitle.textContent = '公共牌';
    communityTitle.style.color = 'white';
    communityCardsReviewDiv.appendChild(communityTitle);
    const communityHandDiv = document.createElement('div');
    communityHandDiv.style.display = 'flex';
    communityHandDiv.style.justifyContent = 'center';
    communityHandDiv.style.gap = '5px'; // 卡牌间距
    gameState.communityCards.forEach(card => {
        communityHandDiv.appendChild(createCardElement(card));
    });
    communityCardsReviewDiv.appendChild(communityHandDiv);
    reviewModal.appendChild(communityCardsReviewDiv);

    // Add player hands container
    const playersHandsContainer = document.createElement('div');
    playersHandsContainer.style.display = 'flex';
    playersHandsContainer.style.flexWrap = 'wrap'; // 允许换行
    playersHandsContainer.style.justifyContent = 'center';
    playersHandsContainer.style.gap = '20px'; // 玩家牌型块之间的间距
    playersHandsContainer.style.width = '100%'; // 占据全部宽度
    playersHandsContainer.style.maxWidth = '1200px'; // 最大宽度限制

    playersInHand.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.style.margin = '10px';
        playerDiv.style.textAlign = 'center';
        playerDiv.style.backgroundColor = 'rgba(255,255,255,0.1)'; // 半透明背景
        playerDiv.style.padding = '15px';
        playerDiv.style.borderRadius = '10px';
        playerDiv.style.minWidth = '250px'; // 最小宽度
        playerDiv.style.flex = '1 1 auto'; // 允许伸缩
        playerDiv.style.maxWidth = '300px'; // 最大宽度
        
        const name = document.createElement('h3');
        name.textContent = `${player.name} - ${player.bestHand.rank}`; // 显示最佳牌型名称
        name.style.color = 'white';
        name.style.marginBottom = '10px';
        playerDiv.appendChild(name);
        
        // Player's hand
        const playerHandTitle = document.createElement('p');
        playerHandTitle.textContent = '手牌:';
        playerHandTitle.style.color = '#ccc';
        playerHandTitle.style.fontSize = '0.9em';
        playerDiv.appendChild(playerHandTitle);
        const handDiv = document.createElement('div');
        handDiv.style.display = 'flex';
        handDiv.style.justifyContent = 'center';
        handDiv.style.gap = '3px';
        player.hand.forEach(card => {
            handDiv.appendChild(createCardElement(card));
        });
        playerDiv.appendChild(handDiv);

        // Best 5-card hand
        const bestHandTitle = document.createElement('p');
        bestHandTitle.textContent = '';
        bestHandTitle.style.color = '#ccc';
        bestHandTitle.style.fontSize = '0.9em';
        bestHandTitle.style.marginTop = '10px';
        playerDiv.appendChild(bestHandTitle);
        const bestFiveHandDiv = document.createElement('div');
        bestFiveHandDiv.style.display = 'flex';
        bestFiveHandDiv.style.justifyContent = 'center';
        bestFiveHandDiv.style.gap = '3px';
        // Ensure bestHand.bestFive is an array of card objects
        if (player.bestHand && Array.isArray(player.bestHand.bestFive)) {
            player.bestHand.bestFive.forEach(card => {
                bestFiveHandDiv.appendChild(createCardElement(card));
            });
        }
        playerDiv.appendChild(bestFiveHandDiv);
        
        playersHandsContainer.appendChild(playerDiv);
    });
    reviewModal.appendChild(playersHandsContainer);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.marginTop = '20px';
    closeButton.style.padding = '10px 20px';
    closeButton.style.backgroundColor = '#4CAF50';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '1em';
    closeButton.addEventListener('click', () => {
        document.body.removeChild(reviewModal);
        // Hide all player hands before resetting for the next hand
        gameState.players.forEach(player => {
            player.showHand = false;
        });
        updateUI();
        resetGameForNextHand();
    });
    reviewModal.appendChild(closeButton);
    
    document.body.appendChild(reviewModal);
}

function resetGameForNextHand() {
    // Move dealer button to the next player
    gameState.dealerButton = (gameState.dealerButton + 1) % gameState.players.length;

    // Filter out players with 0 chips (busted)
    gameState.players = gameState.players.filter(player => player.chips > 0);

    // If only one player left, that player wins the game
    if (gameState.players.length <= 1) {
        alert(`${gameState.players[0].name} 赢得了整场游戏！`);
        // Optionally, reset game completely or show a game over screen
        return;
    }

    // Reset game state for a new hand
    gameState.communityCards = [];
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.gamePhase = 'pre-flop';
    gameState.playersActedInRound = 0;

    // Reset player specific states
    gameState.players.forEach((player, index) => {
        player.hand = [];
        player.bet = 0;
        player.folded = false;
        player.showHand = false; // 确保新局开始时底牌是隐藏的
        player.hasActedInRound = false;
        player.id = index; // Reassign IDs if players were removed
    });

    // Re-initialize deck and deal cards
    initGame(); // Re-shuffles deck
    dealInitialCards();

    // Re-post blinds for the new hand
    const playerCount = gameState.players.length;
    const smallBlindIndex = (gameState.dealerButton + 1) % playerCount;
    const bigBlindIndex = (gameState.dealerButton + 2) % playerCount;

    gameState.players[smallBlindIndex].chips -= gameState.smallBlind;
    gameState.players[smallBlindIndex].bet = gameState.smallBlind;
    gameState.players[smallBlindIndex].hasActedInRound = true;
    gameState.players[bigBlindIndex].chips -= gameState.bigBlind;
    gameState.players[bigBlindIndex].bet = gameState.bigBlind;
    gameState.players[bigBlindIndex].hasActedInRound = true;
    gameState.pot = gameState.smallBlind + gameState.bigBlind;
    gameState.currentBet = gameState.bigBlind;

    gameState.currentPlayerIndex = (bigBlindIndex + 1) % playerCount;
    gameState.roundStartPlayerIndex = gameState.currentPlayerIndex;

    // Skip folded players (shouldn't be any at start of new hand, but for safety)
    while (gameState.players[gameState.currentPlayerIndex].folded) {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        gameState.roundStartPlayerIndex = gameState.currentPlayerIndex;
    }

    // Reset for hand viewing in the new round
    currentPlayerIndex = 0; // Reset the global currentPlayerIndex for hand viewing
    document.getElementById('show-hand').style.display = 'block'; // Show the 'Show Hand' button
    document.getElementById('view-next-hand').style.display = 'none'; // Hide the 'View Next Hand' button

    updateUI();
}

// Show a specific player's hand
function showPlayerHand(playerIndex) {
    if (playerIndex >= 0 && playerIndex < gameState.players.length) {
        gameState.players[playerIndex].showHand = true;
        updateUI();
    }
}

// Hide a specific player's hand
function hidePlayerHand(playerIndex) {
    if (playerIndex >= 0 && playerIndex < gameState.players.length) {
        gameState.players[playerIndex].showHand = false;
        updateUI();
    }
}

let currentPlayerIndex = 0;

function nextPlayerTurn() {
    // Hide current player's hand
    if (currentPlayerIndex < gameState.players.length) {
        gameState.players[currentPlayerIndex].showHand = false;
    }

    currentPlayerIndex++;

    if (currentPlayerIndex < gameState.players.length) {
        // Show next player's hand
        gameState.players[currentPlayerIndex].showHand = true;
    } else {
        // All players have viewed their hands, reset or end the viewing phase
        // For now, let's just hide all hands and disable the button
        gameState.players.forEach(player => player.showHand = false);
        document.getElementById('view-next-hand').style.display = 'none'; // Hide button
        alert('所有玩家已查看完毕。');
        return;
    }
    updateUI();
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
         const startGameButton = document.getElementById('start-game');
         const playerCountInput = document.getElementById('player-count');
         const settingsContainer = document.querySelector('.settings-container');
         const gameContainer = document.querySelector('.game-container');
         const showHandButton = document.getElementById('show-hand');
         const viewNextHandButton = document.getElementById('view-next-hand');
     
         // Hide game container initially
         gameContainer.style.display = 'none';
     
         startGameButton.addEventListener('click', () => {
             const playerCount = parseInt(playerCountInput.value);
             if (playerCount >= 2 && playerCount <= 10) {
                 initializeGame(playerCount);
                 settingsContainer.style.display = 'none';
                 gameContainer.style.display = 'block';
                 // Initial state for hand viewing
                 gameState.players.forEach(player => player.showHand = false);
                 currentPlayerIndex = 0; // Reset current player index for hand viewing
                 showHandButton.style.display = 'block';
                 viewNextHandButton.style.display = 'none';
                 updateUI();
             } else {
                 alert('玩家数量必须在2到10之间。');
             }
         });
     
         showHandButton.addEventListener('click', () => {
             gameState.players[currentPlayerIndex].showHand = true;
             updateUI();
             showHandButton.style.display = 'none';
             viewNextHandButton.style.display = 'block';
         });
     
         viewNextHandButton.addEventListener('click', () => {
             gameState.players[currentPlayerIndex].showHand = false; // Hide current player's hand
             currentPlayerIndex++;
     
             if (currentPlayerIndex < gameState.players.length) {
                 // Prepare for next player
                 showHandButton.style.display = 'block';
                 viewNextHandButton.style.display = 'none';
             } else {
                 // All players have viewed their hands
                 gameState.players.forEach(player => player.showHand = false);
                 showHandButton.style.display = 'none';
                 viewNextHandButton.style.display = 'none';
                 alert('所有玩家已查看完毕。');
             }
             updateUI();
         });
     });

// Event listeners for buttons
document.getElementById('fold').addEventListener('click', fold);
document.getElementById('check').addEventListener('click', check);
document.getElementById('call').addEventListener('click', call);
document.getElementById('raise').addEventListener('click', raise); // Directly call raise function
document.getElementById('show-hand').addEventListener('click', showPlayerHand);
document.getElementById('view-next-hand').addEventListener('click', hidePlayerHand);
// Remove the duplicate raise event listener that uses prompt()
document.getElementById('raise').addEventListener('click', () => {
    const amount = parseInt(prompt('Enter raise amount:', '20'));
    if (!isNaN(amount)) {
        raise(amount);
    }
});

// Helper function to convert and evaluate poker hands
// (Assuming PokerEvaluator.js is loaded and available globally)

function endRoundEarly(winner) {
    winner.chips += gameState.pot;
    // alert(`${winner.name} 赢得了底池 ${gameState.pot} 筹码！`);
    // resetGameForNextHand();
    showdown();
}