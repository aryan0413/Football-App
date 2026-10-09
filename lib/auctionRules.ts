export const AUCTION_STARTING_PURSE = 5000000;
export const AUCTION_BASE_PRICE = 20000;

export function minimumIncrement(currentAmount: number) {
  if (currentAmount >= 1000000) return 150000;
  if (currentAmount >= 500000) return 100000;
  return 50000;
}

export function nextRequiredBid(currentAmount: number) {
  return currentAmount > 0 ? currentAmount + minimumIncrement(currentAmount) : AUCTION_BASE_PRICE;
}

export function formatAuctionMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(amount);
}
