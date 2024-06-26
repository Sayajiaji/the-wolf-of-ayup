import DAOs from "../models/DAOs";
import UserStock from "../models/user/UserStock";
import {Pool} from "pg";
import UserNotFoundError from "../models/error/UserNotFoundError";
import StockNotFoundError from "../models/error/StockNotFoundError";
import InsufficientBalanceError from "../models/error/InsufficientBalanceError";
import InsufficientStockQuantityError from "../models/error/InsufficientStockQuantityError";
import StockTransaction from "../models/transaction/StockTransaction";
import WireTransaction from "../models/transaction/WireTransaction";

class TransactionService {
    private daos: DAOs;
    private pool: Pool;

    constructor(daos: DAOs, pool: Pool) {
        this.daos = daos;
        this.pool = pool;
    }

    /**
     * Buys a stock for a user and updates their balance and stock holdings.
     * @param {string} uid The user ID
     * @param {string} ticker The stock ticker of the stock to buy
     * @param {number} add The quantity of the stock to buy
     * @param {boolean} useCredit Whether to use credit for the purchase
     * @returns {Promise<void>} A promise resolving to nothing
     */
    public async buyStock(uid: string, ticker: string, add: number, useCredit: boolean): Promise<StockTransaction> {
        const pc = await this.pool.connect();

        const user = await this.daos.users.getUserPortfolio(pc, uid);
        const stock = await this.daos.stocks.getStock(pc, ticker);

        if (!user) {
            pc.release();
            throw new UserNotFoundError(uid);
        } else if (!stock) {
            pc.release();
            throw new StockNotFoundError(ticker);
        }

        const cost = stock.price * add;
        const userAvailableCredit = Math.max(user.credit_limit - user.loan_balance, 0);
        let useCreditAmount = 0;
        if (user.balance < cost) {
            if (useCredit && user.balance + userAvailableCredit > stock.price * add) {
                // user has enough credit...
                useCreditAmount = stock.price * add - user.balance;
            } else {
                pc.release();
                throw new InsufficientBalanceError(uid, user.balance, cost);
            }
        }

        const holding = await this.daos.users.getMostRecentStockHolding(pc, uid, ticker);
        const newQuantity = holding ? holding.quantity + add : add;
        const newBalance = user.balance + useCreditAmount - cost;
        const newDebt = user.loan_balance + useCreditAmount;

        try {
            await pc.query('BEGIN');

            const newHolding: UserStock = {
                uid: uid,
                ticker: ticker,
                quantity: newQuantity,
                timestamp: Date.now(),
            };
            await this.daos.users.createStockHolding(pc, newHolding);
            await this.daos.users.updateUser(pc, uid, {balance: newBalance, loan_balance: newDebt});

            // save transaction record
            const transactionRecord: StockTransaction = {
                type: 'buy',
                uid: uid,
                ticker: ticker,
                balance_change: -(cost - useCreditAmount),
                credit_change: useCreditAmount,
                quantity: add,
                price: stock.price,
                total_price: cost,
                timestamp: Date.now(),
            };
            await this.daos.transactions.createTransaction(pc, transactionRecord);
            await pc.query('COMMIT');
            return transactionRecord;
        } catch (err) {
            await pc.query('ROLLBACK');
            throw err; // Re-throw to be handled by the caller
        } finally {
            pc.release();
        }
    }

    public async sellStock(uid: string, ticker: string, remove: number): Promise<StockTransaction> {
        const pc = await this.pool.connect();

        const user = await this.daos.users.getUserPortfolio(pc, uid);
        const stock = await this.daos.stocks.getStock(pc, ticker);
        const holding = await this.daos.users.getMostRecentStockHolding(pc, uid, ticker);

        if (!user) {
            pc.release();
            throw new UserNotFoundError(uid);
        } else if (!stock) {
            pc.release();
            throw new StockNotFoundError(ticker);
        }

        if (!holding || remove > holding.quantity) {
            pc.release();
            throw new InsufficientStockQuantityError(uid, holding?.quantity || 0, remove);
        }

        const newQuantity = holding.quantity - remove;
        const newBalance = user.balance + stock.price * remove;

        try {
            await pc.query('BEGIN');
            const newHolding: UserStock = {
                uid: uid,
                ticker: ticker,
                quantity: newQuantity,
                timestamp: Date.now(),
            };
            await this.daos.users.createStockHolding(pc, newHolding);
            await this.daos.users.updateUser(pc, uid, {balance: newBalance});

            // save transaction record
            const transactionRecord: StockTransaction = {
                type: 'sell',
                uid: uid,
                ticker: ticker,
                quantity: remove,
                balance_change: stock.price * remove,
                credit_change: 0,
                price: stock.price,
                total_price: stock.price * remove,
                timestamp: Date.now(),
            };
            await this.daos.transactions.createTransaction(pc, transactionRecord);
            await pc.query('COMMIT');
            return transactionRecord;
        } catch (err) {
            await pc.query('ROLLBACK');
            throw err; // Re-throw to be handled by the caller
        } finally {
            pc.release();
        }
    }

    public async wireToUser(fromUid: string, destUid: string, amount: number): Promise<WireTransaction> {
        const pc = await this.pool.connect();
        const fromUser = await this.daos.users.getUser(pc, fromUid);
        if (!fromUser) {
            pc.release();
            throw new UserNotFoundError(fromUid);
        }
        const destUser = await this.daos.users.getUser(pc, destUid);
        if (!destUser) {
            pc.release();
            throw new UserNotFoundError(destUid);
        }
        if (fromUser.balance < amount) {
            pc.release();
            throw new InsufficientBalanceError(fromUid, fromUser.balance, amount);
        }

        try {
            await pc.query('BEGIN');
            await this.daos.users.updateUser(pc, fromUid, {balance: fromUser.balance - amount});
            await this.daos.users.updateUser(pc, destUid, {balance: destUser.balance + amount});
            const transactionRecord: WireTransaction = {
                type: 'wire',
                uid: fromUid,
                balance_change: -amount,
                destination: destUid,
                is_destination_user: true,
                timestamp: Date.now(),
            };
            await this.daos.transactions.createTransaction(pc, transactionRecord);
            await pc.query('COMMIT');
            return transactionRecord;
        } catch (err) {
            await pc.query('ROLLBACK');
            throw err;
        } finally {
            pc.release();
        }
    }

    public async wireToEntity(fromUid: string, destIdentifier: string, amount: number): Promise<WireTransaction> {
        const pc = await this.pool.connect();
        const fromUser = await this.daos.users.getUser(pc, fromUid);
        if (!fromUser) {
            pc.release();
            throw new UserNotFoundError(fromUid);
        }
        if (fromUser.balance < amount) {
            pc.release();
            throw new InsufficientBalanceError(fromUid, fromUser.balance, amount);
        }

        try {
            await pc.query('BEGIN');
            await this.daos.users.updateUser(pc, fromUid, {balance: fromUser.balance - amount});
            const transactionRecord: WireTransaction = {
                type: 'wire',
                uid: fromUid,
                balance_change: -amount,
                destination: destIdentifier,
                is_destination_user: false,
                timestamp: Date.now(),
            };
            await this.daos.transactions.createTransaction(pc, transactionRecord);
            await pc.query('COMMIT');
            return transactionRecord;
        } catch (err) {
            await pc.query('ROLLBACK');
            throw err;
        } finally {
            pc.release();
        }
    }
}

export default TransactionService;
