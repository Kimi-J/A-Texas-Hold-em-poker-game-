class PokerEvaluator {
    static evaluateHand(hand, communityCards) {
        const cards = [...hand, ...communityCards];
        if (cards.length < 5) {
            return { rank: 'Incomplete Hand', value: 0, bestHand: [] };
        }
        const result = this.evaluateSevenCardHand(cards);
        return { rank: result.rank, value: result.score, bestHand: result.bestFive };
    }

    static getCardValue(value) {
        if (value == null) return NaN;
        const v = String(value).trim().toLowerCase();
        const map = { a: 14, ace: 14, k: 13, king: 13, q: 12, queen: 12, j: 11, jack: 11 };
        if (Object.prototype.hasOwnProperty.call(map, v)) return map[v];
        const num = parseInt(v, 10);
        return Number.isNaN(num) ? NaN : num;
    }

    static suitToNum(suit) {
        const s = String(suit).toLowerCase();
        if (s === 'hearts') return 1;
        if (s === 'diamonds') return 2;
        if (s === 'clubs') return 3;
        if (s === 'spades') return 4;
        return 0;
    }

    static evaluateSevenCardHand(cards) {
        // Enrich cards with numeric rank and suit number
        const enriched = cards.map(c => ({
            card: c,
            rank: this.getCardValue(c.value),
            suit: c.suit,
            suitNum: this.suitToNum(c.suit)
        })).filter(x => !Number.isNaN(x.rank));

        // Sort by rank ascending
        const byRankAsc = [...enriched].sort((a, b) => a.rank - b.rank);

        // Build helpers
        const byRank = new Map(); // rank -> array of items
        const suitCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
        const presentRanks = new Set();
        const presentBySuit = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };

        for (const it of enriched) {
            if (!byRank.has(it.rank)) byRank.set(it.rank, []);
            byRank.get(it.rank).push(it);
            if (it.suitNum >= 1 && it.suitNum <= 4) {
                suitCount[it.suitNum]++;
                presentBySuit[it.suitNum].add(it.rank);
            }
            presentRanks.add(it.rank);
        }

        // Helper to pick cards by ranks and suit constraint
        const pickCardsByRanks = (ranks, suitNum = null) => {
            const result = [];
            const usedIdx = new Set();
            for (const r of ranks) {
                const choices = byRank.get(r) || [];
                let chosen = null;
                for (let i = 0; i < choices.length; i++) {
                    const cand = choices[i];
                    if (usedIdx.has(cand)) continue;
                    if (suitNum == null || cand.suitNum === suitNum) {
                        chosen = cand;
                        usedIdx.add(cand);
                        break;
                    }
                }
                if (!chosen) return null;
                result.push(chosen.card);
            }
            return result;
        };

        // Straight Flush (includes Royal Flush when starting at 10)
        for (let s = 1; s <= 4; s++) {
            if (suitCount[s] >= 5) {
                for (let i = 10; i >= 2; i--) {
                    let ok = true;
                    for (let r = i; r <= i + 4; r++) {
                        if (!presentBySuit[s].has(r)) { ok = false; break; }
                    }
                    if (ok) {
                        const ranks = [i, i + 1, i + 2, i + 3, i + 4];
                        const bestFive = pickCardsByRanks(ranks, s);
                        const score = (i === 10) ? 100000 : (90000 + i);
                        const rankName = (i === 10) ? 'Royal Flush' : 'Straight Flush';
                        return { score, rank: rankName, bestFive };
                    }
                }
            }
        }

        // Build rank counts sorted descending by count then rank
        const counts = Array.from(byRank.entries()).map(([rank, arr]) => ({ rank, count: arr.length }))
            .sort((a, b) => b.count - a.count || b.rank - a.rank);

        // Four of a Kind
        const four = counts.find(c => c.count === 4);
        if (four) {
            const quads = byRank.get(four.rank).map(x => x.card);
            const kicker = [...enriched]
                .filter(x => x.rank !== four.rank)
                .sort((a, b) => b.rank - a.rank)[0]?.card;
            const bestFive = [...quads, kicker].slice(0, 5);
            const score = 80000 + four.rank;
            return { score, rank: 'Four of a Kind', bestFive };
        }

        // Full House (three + pair)
        const trips = counts.filter(c => c.count >= 3);
        if (trips.length > 0) {
            const tripRank = trips[0].rank;
            const remainingPairs = counts.filter(c => c.rank !== tripRank && c.count >= 2);
            if (remainingPairs.length > 0) {
                const pairRank = remainingPairs[0].rank;
                const bestFive = [
                    ...byRank.get(tripRank).slice(0, 3).map(x => x.card),
                    ...byRank.get(pairRank).slice(0, 2).map(x => x.card)
                ];
                const score = 70000 + tripRank * 100 + pairRank;
                return { score, rank: 'Full House', bestFive };
            }
        }

        // Flush (any suit with 5+), choose top 5 of that suit
        for (let s = 1; s <= 4; s++) {
            if (suitCount[s] >= 5) {
                const suited = enriched.filter(x => x.suitNum === s).sort((a, b) => b.rank - a.rank);
                const bestFive = suited.slice(0, 5).map(x => x.card);
                const score = 60000; // As in C++ reference, no kicker detail encoded
                return { score, rank: 'Flush', bestFive };
            }
        }

        // Straight (non-flush) using unique ranks only; Ace-low (wheel) ignored to match C++ reference
        for (let i = 10; i >= 2; i--) {
            let ok = true;
            for (let r = i; r <= i + 4; r++) {
                if (!presentRanks.has(r)) { ok = false; break; }
            }
            if (ok) {
                // pick one card for each rank r (any suit)
                const ranks = [i, i + 1, i + 2, i + 3, i + 4];
                const bestFive = [];
                const used = new Set();
                for (const r of ranks) {
                    const cand = (byRank.get(r) || []).find(x => !used.has(x));
                    if (cand) { bestFive.push(cand.card); used.add(cand); }
                }
                const score = 50000 + i;
                return { score, rank: 'Straight', bestFive };
            }
        }

        // Three of a Kind
        if (trips.length > 0) {
            const tripRank = trips[0].rank;
            const tripCards = byRank.get(tripRank).slice(0, 3).map(x => x.card);
            const kickers = [...enriched]
                .filter(x => x.rank !== tripRank)
                .sort((a, b) => b.rank - a.rank)
                .slice(0, 2)
                .map(x => x.card);
            const bestFive = [...tripCards, ...kickers];
            const score = 40000 + tripRank;
            return { score, rank: 'Three of a Kind', bestFive };
        }

        // Two Pair
        const pairs = counts.filter(c => c.count >= 2);
        if (pairs.length >= 2) {
            const [p1, p2] = pairs.slice(0, 2).sort((a, b) => b.rank - a.rank);
            const maxPair = Math.max(p1.rank, p2.rank);
            const minPair = Math.min(p1.rank, p2.rank);
            const pairCards = [
                ...byRank.get(maxPair).slice(0, 2).map(x => x.card),
                ...byRank.get(minPair).slice(0, 2).map(x => x.card)
            ];
            const kicker = [...enriched]
                .filter(x => x.rank !== maxPair && x.rank !== minPair)
                .sort((a, b) => b.rank - a.rank)[0]?.card;
            const bestFive = [...pairCards, kicker].slice(0, 5);
            const score = 30000 + 650 * maxPair + 40 * minPair + (this._topRanks(enriched, [maxPair, minPair], 1)[0] || 0);
            return { score, rank: 'Two Pair', bestFive };
        }

        // One Pair
        if (pairs.length === 1) {
            const p = pairs[0].rank;
            const pairCards = byRank.get(p).slice(0, 2).map(x => x.card);
            const kickersRanks = this._topRanks(enriched, [p], 3);
            const kickers = [...enriched]
                .filter(x => kickersRanks.includes(x.rank))
                .sort((a, b) => b.rank - a.rank)
                .slice(0, 3)
                .map(x => x.card);
            const bestFive = [...pairCards, ...kickers];
            const score = 20000 + p * 600 + (kickersRanks[0] || 0) * 12 + (kickersRanks[1] || 0) * 3 + (kickersRanks[2] || 0);
            return { score, rank: 'One Pair', bestFive };
        }

        // High Card
        const topFive = [...enriched].sort((a, b) => b.rank - a.rank).slice(0, 5);
        const r1 = topFive[0]?.rank || 0;
        const r2 = topFive[1]?.rank || 0;
        const r3 = topFive[2]?.rank || 0;
        const r4 = topFive[3]?.rank || 0;
        const r5 = topFive[4]?.rank || 0;
        const score = 10000 + r1 * 500 + r2 * 80 + r3 * 16 + r4 * 4 + r5;
        return { score, rank: 'High Card', bestFive: topFive.map(x => x.card) };
    }

    static _topRanks(enriched, excludeRanks, take) {
        const ex = new Set(excludeRanks);
        const ranks = [...new Set(enriched.filter(x => !ex.has(x.rank)).map(x => x.rank))].sort((a, b) => b - a);
        return ranks.slice(0, take);
    }

    static breakTie(hand1, hand2) {
        const values1 = hand1.map(card => this.getCardValue(card.value)).sort((a, b) => b - a);
        const values2 = hand2.map(card => this.getCardValue(card.value)).sort((a, b) => b - a);

        for (let i = 0; i < values1.length; i++) {
            if (values1[i] > values2[i]) {
                return 1;
            }
            if (values1[i] < values2[i]) {
                return -1;
            }
        }
        return 0;
    }
}