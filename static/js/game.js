let gameState = {
    gamePhase: 'pre-flop', // Possible values: pre-flop, flop, turn, river, showdown
};

// 添加按钮点击动画效果函数
function createRippleEffect(event) {
    const button = event.currentTarget;
    
    // 确保按钮有相对定位，以便正确定位涟漪元素
    if (getComputedStyle(button).position === 'static') {
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
    }
    
    // 创建涟漪元素
    const ripple = document.createElement('span');
    ripple.classList.add('ripple');
    
    // 计算涟漪的大小（取按钮宽高的较大值）
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    // 设置涟漪元素的尺寸和位置
    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
    ripple.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
    
    // 添加到按钮中
    button.appendChild(ripple);
    
    // 动画结束后移除涟漪元素
    ripple.addEventListener('animationend', () => {
        ripple.remove();
    });
}

// 动态为5-10位玩家应用椭圆均匀分布布局（百分比定位）
function applyDynamicSeatLayout(playerCount) {
    const playersLayer = document.getElementById('players-layer');
    if (!playersLayer) return;

    const a = 42; // 横向半径百分比
    const b = 38; // 纵向半径百分比（略小，避免上下贴边）
    const startAngle = -90; // 从顶部开始分布

    // 对于2-4人的情况，清除内联定位，交给CSS专用布局类
    if (playerCount <= 4) {
        const allSeats = playersLayer.querySelectorAll('.seat');
        allSeats.forEach(seat => {
            seat.style.left = '';
            seat.style.top = '';
        });
        return;
    }

    // 5人及以上，按等角度在椭圆上分布显示的前 playerCount 个座位
    for (let i = 0; i < playerCount; i++) {
        const seat = document.getElementById(`seat-${i}`);
        if (!seat) continue;
        const angle = startAngle + (360 / playerCount) * i;
        const rad = angle * Math.PI / 180;
        const leftPercent = 50 + a * Math.cos(rad);
        const topPercent = 50 + b * Math.sin(rad);
        seat.style.left = `${leftPercent}%`;
        seat.style.top = `${topPercent}%`;
    }

    // 隐藏的座位清除内联定位，避免未来切换人数时遗留
    for (let i = playerCount; i < 10; i++) {
        const seat = document.getElementById(`seat-${i}`);
        if (seat) {
            seat.style.left = '';
            seat.style.top = '';
        }
    }
}

function initializeGame(playerCount) {
    gameState = {
        players: [],
        communityCards: [],
        pot: 0,
        pots: [{ amount: 0, eligiblePlayers: [] }], // 主底池和边池数组
        dealerButton: Math.floor(Math.random() * playerCount), // 随机设置第一轮的庄家位置
        smallBlind: 10,
        bigBlind: 20,
        currentBet: 0,
        currentPlayerIndex: 0,
        gamePhase: 'pre-flop',
        roundStartPlayerIndex: 0, // Track who started the current betting round
        playersActedInRound: 0, // Count how many players have acted in the current round
        smallBlindIndex: null,
        bigBlindIndex: null,
    };

    // Initialize the deck and shuffle it
    initGame();

    for (let i = 1; i <= playerCount; i++) {
        // 统一使用数字标识玩家
        const playerName = `玩家${i}`;
        gameState.players.push({ id: i - 1, name: playerName, chips: 1000, hand: [], bet: 0, folded: false, showHand: false, hasActedInRound: false });
    }

    // Determine blinds
    const smallBlindIndex = (gameState.dealerButton + 1) % playerCount;
    const bigBlindIndex = (gameState.dealerButton + 2) % playerCount;
    gameState.smallBlindIndex = smallBlindIndex;
    gameState.bigBlindIndex = bigBlindIndex;

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

// 创建和管理边池的函数
function createSidePots() {
    // 重置底池数组
    gameState.pots = [];
    
    // 获取所有未弃牌的玩家
    const activePlayers = gameState.players.filter(p => !p.folded);
    
    // 如果只有一个活跃玩家，创建一个主池并返回
    if (activePlayers.length <= 1) {
        gameState.pots = [{ amount: gameState.pot, eligiblePlayers: activePlayers.map(p => p.id) }];
        return;
    }
    
    // 按下注金额从小到大排序玩家
    const sortedPlayers = [...activePlayers].sort((a, b) => a.bet - b.bet);
    
    let remainingPot = gameState.pot;
    let processedBet = 0;
    
    // 为每个下注不同的玩家创建边池
    for (let i = 0; i < sortedPlayers.length; i++) {
        const currentPlayer = sortedPlayers[i];
        
        // 如果当前玩家下注为0或已经处理过相同下注金额，跳过
        if (currentPlayer.bet === 0 || (i > 0 && currentPlayer.bet === sortedPlayers[i-1].bet)) {
            continue;
        }
        
        // 计算当前玩家和之前玩家之间的下注差额
        const betDifference = currentPlayer.bet - processedBet;
        
        // 计算这个差额对应的底池金额
        const potAmount = betDifference * (sortedPlayers.length - i);
        
        // 如果有差额，创建一个新的底池
        if (potAmount > 0) {
            // 获取有资格参与这个底池的玩家
            const eligiblePlayers = sortedPlayers.slice(i).map(p => p.id);
            
            // 添加底池
            gameState.pots.push({
                amount: potAmount,
                eligiblePlayers: eligiblePlayers
            });
            
            // 更新剩余底池金额和已处理的下注金额
            remainingPot -= potAmount;
            processedBet = currentPlayer.bet;
        }
    }
    
    // 如果所有玩家下注相同，或者处理完所有不同下注后还有剩余，创建一个主池
    if (gameState.pots.length === 0 || remainingPot > 0) {
        gameState.pots.unshift({
            amount: remainingPot,
            eligiblePlayers: activePlayers.map(p => p.id)
        });
    }
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
        cardDiv.style.backgroundImage = `url('/static/images/cards/card_back.png')`; // Path to card back image
    }
    cardDiv.style.backgroundSize = 'contain';
    cardDiv.style.backgroundRepeat = 'no-repeat';
    cardDiv.style.backgroundColor = 'transparent';
    return cardDiv;
}

// Get card image path
function getCardImagePath(card) {
    return `/static/images/cards/${card.value}_of_${card.suit}.png`;
}

// Update the UI based on game state
function updateUI() {
    // Render seats with player info, badges and active highlight
    renderSeats();

    const communityCardsDiv = document.getElementById('community-cards');
    communityCardsDiv.innerHTML = ''; // Clear existing community cards
    gameState.communityCards.forEach(card => {
        communityCardsDiv.appendChild(createCardElement(card));
    });

    // Update scoreboard fields
    const potEl = document.getElementById('pot-amount');
    const roundEl = document.getElementById('round-name');
    const minRaiseEl = document.getElementById('min-raise');
    
    // 更新底池显示
    if (potEl) {
        // 显示总底池金额
        potEl.textContent = gameState.pot;
        
        // 如果有多个底池，显示详细信息
        if (gameState.pots && gameState.pots.length > 1) {
            let potInfo = `总底池: ${gameState.pot}`;
            gameState.pots.forEach((pot, index) => {
                if (pot.amount > 0) {
                    potInfo += `<br>底池 ${index + 1}: ${pot.amount}`;
                }
            });
            potEl.innerHTML = potInfo;
        } else {
            potEl.textContent = gameState.pot;
        }
    }
    
    if (roundEl) {
        const map = { 'pre-flop': '翻牌前', 'flop': '翻牌', 'turn': '转牌', 'river': '河牌', 'showdown': '摊牌' };
        roundEl.textContent = map[gameState.gamePhase] || gameState.gamePhase;
    }
    if (minRaiseEl) minRaiseEl.textContent = gameState.bigBlind;

    // Update action buttons state
    const player = gameState.players[gameState.currentPlayerIndex];
    const checkBtn = document.getElementById('check');
    const callBtn = document.getElementById('call');

    if (player) {
        if (gameState.currentBet === 0 || player.bet === gameState.currentBet) {
            if (checkBtn) checkBtn.disabled = false;
            if (callBtn) { 
                callBtn.disabled = true; 
                const callBtnText = callBtn.querySelector('.btn-text');
                if (callBtnText) callBtnText.textContent = '跟注';
            }
        } else {
            if (checkBtn) checkBtn.disabled = true;
            const toCall = Math.max(0, gameState.currentBet - player.bet);
            if (callBtn) { 
                callBtn.disabled = false; 
                const callBtnText = callBtn.querySelector('.btn-text');
                if (callBtnText) callBtnText.textContent = `跟注 (${toCall})`;
            }
        }
    }

    console.log('Updating UI with current game state:', gameState);
}

function renderSeats() {
    for (let i = 0; i < 10; i++) {
        const seat = document.getElementById(`seat-${i}`);
        if (!seat) continue;
        const hasPlayer = i < gameState.players.length;
        seat.style.display = hasPlayer ? 'block' : 'none';
        if (!hasPlayer) continue;

        const player = gameState.players[i];
        // 根据是否处于查看手牌阶段决定高亮的座位
        const highlightIndex = (typeof handViewing !== 'undefined' && handViewing)
            ? currentPlayerIndex
            : gameState.currentPlayerIndex;
        seat.classList.toggle('active', i === highlightIndex);

        const nameTag = seat.querySelector('.name-tag');
        if (nameTag) nameTag.textContent = `${player.name}（筹码: ${player.chips}）`;

        const dealerBtn = seat.querySelector('.dealer-btn');
        if (dealerBtn) dealerBtn.style.display = (i === gameState.dealerButton) ? 'inline-block' : 'none';

        const blindTag = seat.querySelector('.blind-tag');
        if (blindTag) {
            if (i === gameState.smallBlindIndex) {
                blindTag.textContent = '小盲';
                blindTag.style.display = 'inline-block';
            } else if (i === gameState.bigBlindIndex) {
                blindTag.textContent = '大盲';
                blindTag.style.display = 'inline-block';
            } else {
                blindTag.style.display = 'none';
            }
        }

        const betTag = seat.querySelector('.bet-tag');
        if (betTag) {
            if (player.bet > 0) {
                betTag.textContent = `${player.bet}`;
                betTag.style.display = 'inline-block';
            } else {
                betTag.style.display = 'none';
            }
        }

        // 渲染或隐藏该座位的底牌
        let cardsContainer = seat.querySelector('.hole-cards');
        if (!cardsContainer) {
            cardsContainer = document.createElement('div');
            cardsContainer.className = 'hole-cards';
            seat.appendChild(cardsContainer);
        }
        // 每次更新先清空
        cardsContainer.innerHTML = '';
        if (player.showHand && Array.isArray(player.hand) && player.hand.length >= 2) {
            cardsContainer.style.display = 'flex';
            cardsContainer.appendChild(createCardElement(player.hand[0], true));
            cardsContainer.appendChild(createCardElement(player.hand[1], true));
        } else {
            cardsContainer.style.display = 'none';
        }

        // Render or hide hole cards near seat if needed in future
    }
}

// Remove the old updateUI implementation that builds a separate players list; rely on seat-based renderSeats instead.
// 旧版基于列表的 updateUI 已移除，改用基于座位的渲染（renderSeats + 顶部新版 updateUI）。

// Player actions
function fold() {
    gameState.players[gameState.currentPlayerIndex].folded = true;
    gameState.players[gameState.currentPlayerIndex].hasActedInRound = true; // 修正拼写错误

    // 检查是否只剩一个玩家未弃牌
    const activePlayers = gameState.players.filter(player => !player.folded);
    if (activePlayers.length === 1) {
        // 创建边池，确保正确分配筹码
        createSidePots();
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
        // 筹码不足，执行All in
        const allInAmount = player.chips;
        player.chips = 0;
        player.bet += allInAmount;
        gameState.pot += allInAmount;
        player.hasActedInRound = true;
        alert(`${player.name} 筹码不足，已All in！`);
        
        // 创建边池
        createSidePots();
        
        nextPlayer();
        return;
    }

    player.chips -= callAmount;
    player.bet = gameState.currentBet; // Player's bet matches current bet
    gameState.pot += callAmount;
    player.hasActedInRound = true;
    
    nextPlayer();
}

function raise(amount) {
    // Prompt if no amount provided or invalid
    if (typeof amount === 'undefined' || isNaN(amount)) {
        const input = prompt('请输入加注金额：', String(gameState.bigBlind || 20));
        amount = parseInt(input, 10);
    }

    if (isNaN(amount) || amount <= 0) {
        alert("请输入有效的加注金额。");
        return;
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    const currentBetForPlayer = player.bet;
    const amountToCall = gameState.currentBet - currentBetForPlayer;
    const totalBetRequired = amountToCall + amount; // Total chips player needs to put in

    if (player.chips < totalBetRequired) {
        // 筹码不足，执行All in
        const allInAmount = player.chips;
        player.chips = 0;
        player.bet += allInAmount;
        gameState.pot += allInAmount;
        player.hasActedInRound = true;
        
        // 如果All in金额大于当前最大下注，更新当前最大下注
        if (player.bet > gameState.currentBet) {
            gameState.currentBet = player.bet;
            // 其他玩家需要重新行动
            gameState.players.forEach((p, idx) => {
                if (idx !== gameState.currentPlayerIndex) {
                    p.hasActedInRound = false;
                }
            });
        }
        
        // 创建边池
        createSidePots();
        
        alert(`${player.name} 筹码不足，已All in！`);
        nextPlayer();
        return;
    }
    
    player.chips -= totalBetRequired;
    player.bet = gameState.currentBet + amount; // Player's new total bet
    gameState.pot += totalBetRequired;
    gameState.currentBet = player.bet; // Update current bet to the new higher bet

    // Other players must act again
    gameState.players.forEach((p, idx) => {
        if (idx !== gameState.currentPlayerIndex) {
            p.hasActedInRound = false;
        }
    });
    player.hasActedInRound = true; // Current player has acted

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

        // If the next player has already acted in this round and their bet matches the current bet or they are all-in
        // and they are not the one who started the round (unless everyone else has acted)
        if (nextPlayer.hasActedInRound && (nextPlayer.bet === gameState.currentBet || nextPlayer.chips === 0)) {
            // This player has already acted and matched the bet or is all-in, skip them unless they are the last to act
            // and everyone else has also acted and matched or is all-in.
            const activePlayers = gameState.players.filter(p => !p.folded);
            const allActivePlayersActed = activePlayers.every(p => p.hasActedInRound);
            const allActivePlayersMatchedBet = activePlayers.every(p => p.bet === gameState.currentBet || p.chips === 0);

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

    // Check if all active players have matched the current bet or are all-in (chips = 0)
    const allActivePlayersMatchedBet = activePlayers.every(p => p.bet === gameState.currentBet || p.chips === 0);

    // If all active players have acted AND all active players have matched the current bet or are all-in
    return allActivePlayersActed && allActivePlayersMatchedBet;
}

function endBettingRound() {
    // 在重置下注前，确保边池已正确创建
    createSidePots();
    
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

    // 确保边池已正确创建
    createSidePots();
    
    // 评估每个玩家的最佳手牌
    for (const player of playersInHand) {
        player.bestHand = PokerEvaluator.evaluateHand(player.hand, gameState.communityCards);
    }
    
    let winnerMessage = '赢家：\n';
    
    // 处理每个底池
    for (let i = 0; i < gameState.pots.length; i++) {
        const pot = gameState.pots[i];
        
        // 获取有资格参与这个底池的玩家
        const eligiblePlayers = playersInHand.filter(p => pot.eligiblePlayers.includes(p.id));
        
        if (eligiblePlayers.length === 0) {
            continue; // 跳过没有合格玩家的底池
        }
        
        if (eligiblePlayers.length === 1) {
            // 只有一个玩家有资格，直接获得底池
            const winner = eligiblePlayers[0];
            winner.chips += pot.amount;
            winnerMessage += `${winner.name} 赢得了底池 ${i+1} 的 ${pot.amount} 筹码！\n`;
            continue;
        }
        
        // 找出这个底池的赢家
        let potWinners = [];
        let bestHandResult = null;
        
        for (const player of eligiblePlayers) {
            if (!bestHandResult || player.bestHand.value > bestHandResult.value) {
                bestHandResult = player.bestHand;
                potWinners = [player];
            } else if (player.bestHand.value === bestHandResult.value) {
                // 比较手牌进行平局判断
                const tieResult = PokerEvaluator.breakTie(player.bestHand.bestHand, bestHandResult.bestHand);
                if (tieResult === 1) {
                    bestHandResult = player.bestHand;
                    potWinners = [player];
                } else if (tieResult === 0) {
                    potWinners.push(player); // 真正平局，添加到赢家列表
                }
                // 如果tieResult是-1，当前赢家更好，不做任何操作
            }
        }
        
        // 在赢家之间分配这个底池
        const potAmountPerWinner = Math.floor(pot.amount / potWinners.length);
        for (const winner of potWinners) {
            winner.chips += potAmountPerWinner;
            winnerMessage += `${winner.name} 凭借 ${winner.bestHand.rank} 牌型赢得了底池 ${i+1} 的 ${potAmountPerWinner} 筹码！\n`;
        }
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
    gameState.pots = [{ amount: 0, eligiblePlayers: [] }]; // 重置边池数组
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
let handViewing = false; // 是否处于顺序查看手牌阶段

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
        // 所有玩家查看完毕
        gameState.players.forEach(player => player.showHand = false);
        document.getElementById('view-next-hand').style.display = 'none'; // Hide button
        document.getElementById('show-hand').style.display = 'block'; // Show first button again
        handViewing = false;
        alert('所有玩家已查看完毕。');
        return;
    }
    updateUI();
}

// Initialize game when DOM is loaded
// 导出游戏进度功能
function exportGameProgress() {
    // 创建一个副本，避免修改原始游戏状态
    const exportData = JSON.stringify(gameState);
    
    // 创建Blob对象
    const blob = new Blob([exportData], { type: 'application/json' });
    
    // 创建下载链接
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `poker_game_${new Date().toISOString().replace(/[:.]/g, '-')}.dpdata`;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// 导入游戏进度功能
function importGameProgress(file) {
    const reader = new FileReader();
    
    reader.onload = function(event) {
        try {
            // 解析JSON数据
            const importedState = JSON.parse(event.target.result);
            
            // 恢复游戏状态
            gameState = importedState;
            
            // 更新UI
            updateUI();
            
            alert('游戏进度已成功导入！');
        } catch (error) {
            console.error('导入游戏进度失败:', error);
            alert('导入失败，文件格式不正确！');
        }
    };
    
    reader.onerror = function() {
        console.error('读取文件失败！');
        alert('读取文件失败！');
    };
    
    reader.readAsText(file);
}

// 处理导入按钮点击事件
function handleImportButtonClick() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dpdata';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            importGameProgress(file);
        }
    };
    
    input.click();
}

document.addEventListener('DOMContentLoaded', () => {
    const showHandButton = document.getElementById('show-hand');
    const viewNextHandButton = document.getElementById('view-next-hand');
    const playerCountModal = document.getElementById('player-count-modal');
    const gameContainer = document.querySelector('.game-container');
    const playerCountInput = document.getElementById('player-count-input');
    const startGameBtn = document.getElementById('start-game-btn');
    const exportBtn = document.getElementById('export-progress');
    const importBtn = document.getElementById('import-progress');
    const importFileInput = document.getElementById('import-file');
    
    // 为导出和导入按钮添加事件监听器
    if (exportBtn) {
        exportBtn.addEventListener('click', function(event) {
            createRippleEffect(event);
            exportGameProgress();
        });
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', function(event) {
            createRippleEffect(event);
            // 使用隐藏的文件输入框
            importFileInput.click();
        });
    }
    
    // 为文件输入框添加change事件
    if (importFileInput) {
        importFileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                importGameProgress(file);
            }
        });
    }
    
    // 修改按钮文本
    showHandButton.textContent = '看牌';
    viewNextHandButton.textContent = '查看完毕';
    
    // 为所有操作按钮添加点击动画效果
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
        button.addEventListener('click', createRippleEffect);
    });

    // 为开始游戏按钮也添加点击动画效果
    startGameBtn.addEventListener('click', createRippleEffect);
    
    // 开始游戏按钮点击事件
    startGameBtn.addEventListener('click', () => {
        let playerCount = parseInt(playerCountInput.value);
        
        // 验证玩家数量
        if (isNaN(playerCount) || playerCount < 2) {
            playerCount = 2; // 最少2人
        } else if (playerCount > 10) {
            playerCount = 10; // 最多10人
        }
        
        // 隐藏不需要的座位
        const seats = document.querySelectorAll('.seat');
        seats.forEach((seat, index) => {
            if (index < playerCount) {
                seat.style.display = 'block';
            } else {
                seat.style.display = 'none';
            }
        });
        
        // 应用对应人数的布局类
        const playersLayer = document.getElementById('players-layer');
        // 先移除所有布局类
        playersLayer.classList.remove('two-players', 'three-players', 'four-players');
        
        // 根据人数添加对应的布局类
        if (playerCount === 2) {
            playersLayer.classList.add('two-players');
            playersLayer.classList.remove('dynamic-layout');
        } else if (playerCount === 3) {
            playersLayer.classList.add('three-players');
            playersLayer.classList.remove('dynamic-layout');
        } else if (playerCount === 4) {
            playersLayer.classList.add('four-players');
            playersLayer.classList.remove('dynamic-layout');
        } else {
            // 5-10人：启用动态布局类，由JS控制
            playersLayer.classList.add('dynamic-layout');
        }
        
        // 5人及以上使用动态布局
        applyDynamicSeatLayout(playerCount);
        
        // 初始化游戏
        initializeGame(playerCount);
        
        // 隐藏对话框，显示游戏界面
        playerCountModal.style.display = 'none';
        gameContainer.style.display = 'block';
        
        // 初始：未进入查看阶段，隐藏所有底牌
        gameState.players.forEach(player => (player.showHand = false));
        currentPlayerIndex = 0;
        handViewing = false;
        showHandButton.style.display = 'block';
        viewNextHandButton.style.display = 'none';
        updateUI();
    });

    // 第一次点击：开始查看阶段，展示当前玩家底牌，并切换到"查看完毕"
    showHandButton.addEventListener('click', () => {
        handViewing = true;
        gameState.players[currentPlayerIndex].showHand = true;
        updateUI();
        showHandButton.style.display = 'none';
        viewNextHandButton.style.display = 'block';
    });

    // 点击"查看完毕"：隐藏当前玩家牌，准备下一位玩家查看
    viewNextHandButton.addEventListener('click', () => {
        gameState.players[currentPlayerIndex].showHand = false; // 隐藏当前玩家
        currentPlayerIndex++;

        if (currentPlayerIndex < gameState.players.length) {
            // 准备下一位玩家查看
            showHandButton.style.display = 'block';
            viewNextHandButton.style.display = 'none';
        } else {
            // 结束查看阶段
            handViewing = false;
            gameState.players.forEach(player => (player.showHand = false));
            showHandButton.style.display = 'block';
            viewNextHandButton.style.display = 'none';
            currentPlayerIndex = 0; // 重置为第一位玩家
            alert('所有玩家已查看完毕。');
        }
        updateUI();
    });

    // Attach action buttons once DOM is ready
    document.getElementById('fold').addEventListener('click', fold);
    document.getElementById('check').addEventListener('click', check);
    document.getElementById('call').addEventListener('click', call);
    document.getElementById('raise').addEventListener('click', () => raise());
});

// Helper function to convert and evaluate poker hands
// (Assuming PokerEvaluator.js is loaded and available globally)

function endRoundEarly(winner) {
    // 确保边池已正确创建
    createSidePots();
    
    // 如果只有一个玩家未弃牌，他赢得所有底池
    let totalWinnings = 0;
    for (const pot of gameState.pots) {
        winner.chips += pot.amount;
        totalWinnings += pot.amount;
    }
    
    alert(`${winner.name} 赢得了总计 ${totalWinnings} 筹码！`);
    resetGameForNextHand();
}