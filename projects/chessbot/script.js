/*
 * ================================================================
 * CHESS PVP + STARTER ENGINE — JAVASCRIPT
 * ================================================================
 * Responsibilities:
 * 1. chess.js handles the official chess rules and legal moves.
 * 2. This file handles the board UI, player input and game controls.
 * 3. The starter engine chooses moves using minimax + alpha-beta pruning.
 *
 * ENGINE DESIGN:
 * - Beginner: shallow search and some move variety.
 * - Club: deeper search and a more consistent evaluation.
 * - Strong: deeper search with move ordering.
 *
 * This is deliberately a small learning engine, not a replacement for
 * Stockfish. It gives us a foundation that can be improved in stages.
 * ================================================================
 */

// Import chess.js. It validates moves and maintains the complete chess state.
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

// ----------------------------------------------------------------
// 1. GAME STATE AND HTML ELEMENT REFERENCES
// ----------------------------------------------------------------

const game = new Chess();

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const turnElement = document.getElementById("turn");
const historyElement = document.getElementById("move-history");
const undoButton = document.getElementById("undo-button");
const newGameButton = document.getElementById("new-game-button");
const flipButton = document.getElementById("flip-button");
const clearButton = document.getElementById("clear-button");
const promotionDialog = document.getElementById("promotion-dialog");
const opponentSelect = document.getElementById("opponent-select");
const difficultySelect = document.getElementById("difficulty-select");
const engineStatusElement = document.getElementById("engine-status");

// Use solid chess glyphs for both sides. CSS tints them white or dark.
const PIECE_SYMBOLS = {
  wk: "♚", wq: "♛", wr: "♜", wb: "♝", wn: "♞", wp: "♟",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
};

// UI state; these variables do not alter the actual chess position.
let selectedSquare = null;
let legalDestinations = [];
let boardIsFlipped = false;
let pendingPromotion = null;
let engineIsThinking = false;

// The human always plays White in computer mode.
// In human mode both sides can use the same board.
const HUMAN_COLOR = "w";

// ----------------------------------------------------------------
// 2. BOARD DISPLAY
// ----------------------------------------------------------------

function getDisplaySquares() {
  // Generate rank/file order based on board orientation.
  const files = boardIsFlipped ? "hgfedcba" : "abcdefgh";
  const ranks = boardIsFlipped ? "12345678" : "87654321";
  return [...ranks].flatMap(rank => [...files].map(file => file + rank));
}

function renderBoard() {
  boardElement.innerHTML = "";

  const position = game.board();
  const verboseHistory = game.history({ verbose: true });
  const lastMove = verboseHistory.length ? verboseHistory[verboseHistory.length - 1] : null;
  const lastMoveSquares = lastMove ? [lastMove.from, lastMove.to] : [];

  for (const squareName of getDisplaySquares()) {
    const fileIndex = squareName.charCodeAt(0) - 97;
    const rankIndex = 8 - Number(squareName[1]);
    const piece = position[rankIndex][fileIndex];

    const squareButton = document.createElement("button");
    squareButton.type = "button";
    squareButton.className = "square";
    squareButton.dataset.square = squareName;
    squareButton.setAttribute(
      "aria-label",
      piece
        ? `${squareName}, ${piece.color === "w" ? "White" : "Black"} ${piece.type}`
        : `${squareName}, empty`
    );

    // a8 is light; h1 is light as well.
    const isLightSquare = (fileIndex + rankIndex) % 2 === 0;
    squareButton.classList.add(isLightSquare ? "light" : "dark");

    if (selectedSquare === squareName) squareButton.classList.add("selected");
    if (lastMoveSquares.includes(squareName)) squareButton.classList.add("last-move");

    if (piece) {
      const pieceElement = document.createElement("span");
      pieceElement.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      pieceElement.textContent = PIECE_SYMBOLS[piece.color + piece.type];
      squareButton.appendChild(pieceElement);
    }

    // A dot means a quiet legal move; a ring means a legal capture.
    if (legalDestinations.includes(squareName)) {
      const marker = document.createElement("span");
      marker.className = piece ? "legal-capture" : "legal-dot";
      squareButton.appendChild(marker);
    }

    // Rank labels appear on the left edge.
    const isLeftEdge = boardIsFlipped ? fileIndex === 7 : fileIndex === 0;
    if (isLeftEdge) {
      const label = document.createElement("span");
      label.className = "coordinate rank";
      label.textContent = squareName[1];
      squareButton.appendChild(label);
    }

    // File labels appear along the bottom edge.
    const isBottomEdge = boardIsFlipped ? rankIndex === 0 : rankIndex === 7;
    if (isBottomEdge) {
      const label = document.createElement("span");
      label.className = "coordinate file";
      label.textContent = squareName[0];
      squareButton.appendChild(label);
    }

    squareButton.addEventListener("click", () => handleSquareClick(squareName));
    boardElement.appendChild(squareButton);
  }

  renderGameStatus();
  renderMoveHistory();

  undoButton.disabled = game.history().length === 0 || engineIsThinking;
  opponentSelect.disabled = engineIsThinking;
  difficultySelect.disabled = engineIsThinking || opponentSelect.value !== "computer";
  clearButton.disabled = engineIsThinking;
}

// ----------------------------------------------------------------
// 3. STATUS AND MOVE HISTORY
// ----------------------------------------------------------------

function renderGameStatus() {
  const sideToMove = game.turn() === "w" ? "White" : "Black";

  if (game.isCheckmate()) {
    const winner = sideToMove === "White" ? "Black" : "White";
    statusElement.textContent = `Checkmate — ${winner} wins`;
    turnElement.textContent = "Game over";
    return;
  }

  if (game.isStalemate()) {
    statusElement.textContent = "Draw — stalemate";
    turnElement.textContent = "Game over";
    return;
  }

  if (game.isInsufficientMaterial()) {
    statusElement.textContent = "Draw — insufficient material";
    turnElement.textContent = "Game over";
    return;
  }

  if (game.isThreefoldRepetition()) {
    statusElement.textContent = "Draw — threefold repetition";
    turnElement.textContent = "Game over";
    return;
  }

  if (game.isDraw()) {
    statusElement.textContent = "Draw";
    turnElement.textContent = "Game over";
    return;
  }

  turnElement.textContent = `${sideToMove} to move`;
  statusElement.textContent = game.isCheck()
    ? `${sideToMove} is in check`
    : "Game in progress";
}

function renderMoveHistory() {
  const moves = game.history();

  if (moves.length === 0) {
    historyElement.innerHTML = '<p class="empty-history">No moves yet.</p>';
    return;
  }

  historyElement.innerHTML = "";

  for (let index = 0; index < moves.length; index += 2) {
    const moveNumber = document.createElement("span");
    moveNumber.className = "move-number";
    moveNumber.textContent = `${Math.floor(index / 2) + 1}.`;

    const whiteMove = document.createElement("span");
    whiteMove.className = "move-entry";
    whiteMove.textContent = moves[index] || "";

    const blackMove = document.createElement("span");
    blackMove.className = "move-entry";
    blackMove.textContent = moves[index + 1] || "";

    if (index === moves.length - 1) whiteMove.classList.add("latest");
    if (index + 1 === moves.length - 1) blackMove.classList.add("latest");

    historyElement.append(moveNumber, whiteMove, blackMove);
  }

  historyElement.scrollTop = historyElement.scrollHeight;
}

// ----------------------------------------------------------------
// 4. PLAYER INPUT
// ----------------------------------------------------------------

function isHumanTurn() {
  // In computer mode, only White is controlled by the human.
  return opponentSelect.value === "human" || game.turn() === HUMAN_COLOR;
}

function handleSquareClick(squareName) {
  // Ignore input after the game ends, during promotion, or during engine search.
  if (game.isGameOver() || pendingPromotion || engineIsThinking || !isHumanTurn()) {
    return;
  }

  const clickedPiece = game.get(squareName);

  // If this square is a legal destination for the selected piece, move there.
  if (selectedSquare && legalDestinations.includes(squareName)) {
    const matchingMoves = game.moves({ square: selectedSquare, verbose: true })
      .filter(move => move.to === squareName);

    // Pawn promotion needs the player to choose the new piece first.
    if (matchingMoves.some(move => move.promotion)) {
      pendingPromotion = { from: selectedSquare, to: squareName };
      promotionDialog.classList.add("visible");
      return;
    }

    game.move({ from: selectedSquare, to: squareName });
    clearPieceSelection();
    renderBoard();
    maybeStartEngineTurn();
    return;
  }

  // Select a piece only if it belongs to the side whose turn it is.
  if (clickedPiece && clickedPiece.color === game.turn()) {
    selectedSquare = squareName;
    legalDestinations = game.moves({ square: squareName, verbose: true })
      .map(move => move.to);
  } else {
    clearPieceSelection();
  }

  renderBoard();
}

function clearPieceSelection() {
  selectedSquare = null;
  legalDestinations = [];
}

// ----------------------------------------------------------------
// 5. PAWN PROMOTION
// ----------------------------------------------------------------

document.querySelectorAll("[data-promotion]").forEach(button => {
  button.addEventListener("click", () => {
    if (!pendingPromotion) return;

    // The button stores one of the promotion piece letters: q, r, b or n.
    game.move({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion: button.dataset.promotion
    });

    closePromotionDialog();
    clearPieceSelection();
    renderBoard();
    maybeStartEngineTurn();
  });
});

function closePromotionDialog() {
  pendingPromotion = null;
  promotionDialog.classList.remove("visible");
}

// ----------------------------------------------------------------
// 6. STARTER CHESS ENGINE: EVALUATION
// ----------------------------------------------------------------

// Basic piece values in centipawns (100 = roughly one pawn).
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000
};

// Convert a file/rank coordinate to distance from the board centre.
// This rewards pieces that occupy useful central squares.
function centreBonus(file, rank) {
  const fileDistance = Math.abs(3.5 - file);
  const rankDistance = Math.abs(3.5 - rank);
  return 7 - (fileDistance + rankDistance) * 2;
}

/**
 * Evaluate a position from White's perspective.
 * Positive score favours White; negative score favours Black.
 *
 * This is intentionally understandable rather than sophisticated.
 * It evaluates material, central activity, pawn advancement and bishop pair.
 */
function evaluatePosition(chess) {
  const board = chess.board();
  let score = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;

      const sign = piece.color === "w" ? 1 : -1;
      const type = piece.type;
      const material = PIECE_VALUES[type];

      // Material is the foundation: a queen is worth more than a pawn.
      score += sign * material;

      if (type === "b") {
        if (piece.color === "w") whiteBishops++;
        else blackBishops++;
      }

      // Knights and bishops generally benefit from central squares.
      if (type === "n" || type === "b") {
        score += sign * centreBonus(file, rank) * (type === "n" ? 2 : 1);
      }

      // Encourage pawns to advance, but do not overvalue them.
      if (type === "p") {
        const advancement = piece.color === "w" ? 6 - rank : rank - 1;
        score += sign * advancement * 7;
        score += sign * centreBonus(file, rank) * 1.5;
      }

      // Small centralization bonus for the king in the endgame.
      if (type === "k") {
        const nonKingPieces = board.flat().filter(p => p && p.type !== "k").length;
        if (nonKingPieces <= 8) {
          score += sign * centreBonus(file, rank) * 3;
        }
      }
    }
  }

  // A pair of bishops is a useful long-term advantage.
  if (whiteBishops >= 2) score += 28;
  if (blackBishops >= 2) score -= 28;

  return score;
}

// ----------------------------------------------------------------
// 7. STARTER CHESS ENGINE: MINIMAX + ALPHA-BETA PRUNING
// ----------------------------------------------------------------

/**
 * Convert evaluation to the perspective of the side whose turn it is.
 * This lets the search use negamax: each side tries to maximize its score.
 */
function evaluateForSideToMove(chess) {
  const whiteScore = evaluatePosition(chess);
  return chess.turn() === "w" ? whiteScore : -whiteScore;
}

/**
 * Order promising moves first.
 * Captures and promotions are searched early, helping alpha-beta prune more.
 */
function orderMoves(moves) {
  const value = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };

  return moves.sort((a, b) => {
    const scoreMove = move => {
      let score = 0;
      if (move.captured) {
        // Prefer winning a valuable piece with a less valuable attacker.
        score += 1000 + value[move.captured] - value[move.piece] / 10;
      }
      if (move.promotion) score += 800 + value[move.promotion];
      if (move.san.includes("+")) score += 40;
      return score;
    };

    return scoreMove(b) - scoreMove(a);
  });
}

/**
 * Negamax search.
 *
 * depth: how many half-moves ahead to examine.
 * alpha: best score the current search path can guarantee.
 * beta: opponent's cutoff threshold.
 * ply: number of plies from the root, used to prefer quicker mates.
 */
function negamax(chess, depth, alpha, beta, ply = 0) {
  // Terminal positions must be checked before the depth cutoff.
  if (chess.isCheckmate()) return -100000 + ply;
  if (chess.isDraw()) return 0;

  // At depth zero, return the static evaluation.
  if (depth === 0) return evaluateForSideToMove(chess);

  let bestScore = -Infinity;
  const moves = orderMoves(chess.moves({ verbose: true }));

  for (const move of moves) {
    // Play the candidate move on the search position.
    chess.move(move);

    // Negate the opponent's score because their perspective is reversed.
    const score = -negamax(chess, depth - 1, -beta, -alpha, ply + 1);

    // Restore the position before examining the next candidate.
    chess.undo();

    if (score > bestScore) bestScore = score;
    if (score > alpha) alpha = score;

    // Alpha-beta cutoff: remaining moves cannot improve this line.
    if (alpha >= beta) break;
  }

  return bestScore;
}

/**
 * Choose the engine's move.
 * The game itself is not changed during search; a temporary Chess instance
 * is created from the current FEN and used to explore possible continuations.
 */
function findBestEngineMove() {
  const difficulty = difficultySelect.value;

  // Each level increases the number of half-moves searched.
  const searchDepth = {
    beginner: 1,
    club: 2,
    strong: 3
  }[difficulty] || 2;

  const searchPosition = new Chess(game.fen());
  const legalMoves = orderMoves(searchPosition.moves({ verbose: true }));

  if (legalMoves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of legalMoves) {
    searchPosition.move(move);

    // Search from the opponent's point of view, then reverse the score.
    const score = -negamax(
      searchPosition,
      searchDepth - 1,
      -Infinity,
      Infinity,
      1
    );

    searchPosition.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  // Beginner mode chooses randomly among equally scored moves.
  // This makes the lowest level less predictable and less rigid.
  const chosenIndex = difficulty === "beginner"
    ? Math.floor(Math.random() * bestMoves.length)
    : 0;

  return bestMoves[chosenIndex];
}

// ----------------------------------------------------------------
// 8. ENGINE TURN MANAGEMENT
// ----------------------------------------------------------------

/**
 * Run the engine after the human has moved.
 * setTimeout lets the browser paint the "thinking" status before searching.
 */
function maybeStartEngineTurn() {
  if (opponentSelect.value !== "computer") return;
  if (game.isGameOver() || game.turn() !== "b") return;

  engineIsThinking = true;
  engineStatusElement.textContent = "Thinking…";
  clearPieceSelection();
  renderBoard();

  // Small delay makes the computer's turn visible instead of instantaneous.
  window.setTimeout(() => {
    // A new game or mode change may have happened before this callback runs.
    if (opponentSelect.value !== "computer" || game.isGameOver() || game.turn() !== "b") {
      engineIsThinking = false;
      renderBoard();
      return;
    }

    const engineMove = findBestEngineMove();

    if (engineMove) {
      // Apply the engine's selected move to the real game.
      game.move({
        from: engineMove.from,
        to: engineMove.to,
        promotion: engineMove.promotion
      });
    }

    engineIsThinking = false;
    engineStatusElement.textContent = "Ready";
    renderBoard();
  }, 120);
}

// ----------------------------------------------------------------
// 9. GAME CONTROLS AND SETTINGS
// ----------------------------------------------------------------

// Undo one full turn in computer mode (human move + engine reply).
undoButton.addEventListener("click", () => {
  if (engineIsThinking) return;

  // In computer mode, undo a complete human+engine turn when the engine
  // has already replied. If the last move was White's (for example, White
  // delivered checkmate), undo only that one move.
  const historyBeforeUndo = game.history({ verbose: true });
  const lastMove = historyBeforeUndo[historyBeforeUndo.length - 1];

  if (
    opponentSelect.value === "computer" &&
    lastMove &&
    lastMove.color === "b"
  ) {
    game.undo(); // Remove the computer's reply.
    game.undo(); // Remove the human move that prompted that reply.
  } else {
    game.undo(); // Human-vs-human, or no computer reply has been made.
  }

  closePromotionDialog();
  clearPieceSelection();
  engineStatusElement.textContent = "Ready";
  renderBoard();
});

// Start a new game and return the board to its standard position.
newGameButton.addEventListener("click", () => {
  game.reset();
  engineIsThinking = false;
  closePromotionDialog();
  clearPieceSelection();
  engineStatusElement.textContent = "Ready";
  renderBoard();
});

// Flip the view only; this does not alter the actual position.
flipButton.addEventListener("click", () => {
  boardIsFlipped = !boardIsFlipped;
  renderBoard();
});

// Clear selection highlights.
clearButton.addEventListener("click", () => {
  clearPieceSelection();
  renderBoard();
});

// Changing opponent resets the game to avoid confusing turn ownership.
opponentSelect.addEventListener("change", () => {
  game.reset();
  engineIsThinking = false;
  closePromotionDialog();
  clearPieceSelection();
  engineStatusElement.textContent = "Ready";
  renderBoard();
  maybeStartEngineTurn();
});

// Difficulty can be changed during a game; it affects the next engine move.
difficultySelect.addEventListener("change", () => {
  const labels = {
    beginner: "Beginner selected",
    club: "Club level selected",
    strong: "Strong level selected"
  };
  engineStatusElement.textContent = labels[difficultySelect.value] || "Ready";
});

// ----------------------------------------------------------------
// 10. INITIALIZE
// ----------------------------------------------------------------

// Draw the initial position. Computer mode starts with the human as White.
renderBoard();

// ----------------------------------------------------------------
// 11. IDEAS FOR FUTURE ENGINE DEVELOPMENT
// ----------------------------------------------------------------
/*
 * Possible next steps:
 *
 * 1. Increase search depth with iterative deepening.
 * 2. Add quiescence search so the engine does not stop in the middle
 *    of a capture sequence.
 * 3. Add piece-square tables for more accurate positional evaluation.
 * 4. Add transposition tables to avoid searching the same position twice.
 * 5. Add opening-book support.
 * 6. Move the engine into a Web Worker so deeper searches do not block
 *    the user interface.
 * 7. Eventually connect a Python engine or write a stronger JS engine.
 *
 * Keep move selection separate from the chess rules and board rendering.
 */
