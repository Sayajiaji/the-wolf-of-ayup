import DAOs from "../models/DAOs";
import {Pool} from "pg";
import Stock from "../models/stock/Stock";

class StockService {
    private daos: DAOs;
    private pool: Pool;

    constructor(daos: DAOs, pool: Pool) {
        this.daos = daos;
        this.pool = pool;
    }

    public async getStock(ticker: string): Promise<Stock | null> {
        const pc = await this.pool.connect();
        const res = await this.daos.stocks.getStock(pc, ticker);
        pc.release();
        return res;
    }

    public async createStock(stock: Stock): Promise<void> {
        const pc = await this.pool.connect();
        const res = await this.daos.stocks.createStock(pc, stock);
        pc.release();
        return res;
    }

    public async updateStock(ticker: string, stock: Partial<Stock>): Promise<void> {
        const pc = await this.pool.connect();
        const res = await this.daos.stocks.updateStock(pc, ticker, stock);
        pc.release();
        return res;
    }

    public async getAllStocks(): Promise<Stock[]> {
        const pc = await this.pool.connect();
        const res = await this.daos.stocks.getAllStocks(pc);
        pc.release();
        return res;
    }
}

export default StockService;
