export class SparseModel {
  constructor() {
    this.colCost = [];
    this.colLower = [];
    this.colUpper = [];
    this.integrality = [];
    this.rowLower = [];
    this.rowUpper = [];
    this.starts = [0];
    this.indices = [];
    this.values = [];
  }
  variable(cost = 0, upper = 1, integer = true, lower = 0) {
    const index = this.colCost.length;
    this.colCost.push(cost);
    this.colLower.push(lower);
    this.colUpper.push(upper);
    this.integrality.push(integer ? 1 : 0);
    return index;
  }
  row(terms, lower = -Infinity, upper = Infinity) {
    const summed = new Map();
    for (const [index, value] of terms) {
      if (!Number.isInteger(index)) throw new Error("Invalid model variable");
      summed.set(index, (summed.get(index) || 0) + value);
    }
    for (const [index, value] of summed)
      if (value !== 0) {
        this.indices.push(index);
        this.values.push(value);
      }
    this.starts.push(this.indices.length);
    this.rowLower.push(lower);
    this.rowUpper.push(upper);
  }
  finish() {
    const numCols = this.colCost.length,
      numRows = this.rowLower.length;
    return {
      numCols,
      numRows,
      sense: -1,
      colCost: Float64Array.from(this.colCost),
      colLower: Float64Array.from(this.colLower),
      colUpper: Float64Array.from(this.colUpper),
      integrality: Int32Array.from(this.integrality),
      rowLower: Float64Array.from(this.rowLower),
      rowUpper: Float64Array.from(this.rowUpper),
      matrix: {
        format: "csr",
        numRows,
        numCols,
        starts: Int32Array.from(this.starts),
        indices: Int32Array.from(this.indices),
        values: Float64Array.from(this.values),
      },
    };
  }
}
