/*
 * ================================================================
 * CHESS PVP — JAVASCRIPT
 * ================================================================
 * This file connects the page to the chess rules library.
 *
 * IMPORTANT ARCHITECTURE NOTE:
 * - HTML defines the page structure.
 * - CSS defines the visual appearance.
 * - This JavaScript controls the board, user input and game state.
 * - chess.js supplies the chess rules: legal moves, check, castling,
 *   en passant, promotion, checkmate, stalemate, and draw conditions.
 *
 * chess.js is a rules library, NOT a computer opponent. Both players
 * still move manually. Later, an AI engine can choose moves and call
 * the same game.move(...) interface.
 * ================================================================
 */

// Import the chess rules library from a CDN.
// This keeps the project to the three requested files.
// The browser needs an internet connection to load this dependency.
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

// ----------------------------------------------------------------
// 1. GAME STATE AND HTML ELEMENT REFERENCES
// ----------------------------------------------------------------

// Create a new game in the standard starting position.
const game = new Chess();

// Cache important HTML elements so we do not repeatedly search the page.
const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const turnElement = document.getElementById("turn");
const historyElement = document.getElementById("move-history");
const undoButton = document.getElementById("undo-button");
const newGameButton = document.getElementById("new-game-button");
const flipButton = document.getElementById("flip-button");
const clearButton = document.getElementById("clear-button");
const promotionDialog = document.getElementById("promotion-dialog");

// Unicode chess symbols used to display pieces.
// The key combines piece color ("w" or "b") and piece type.
const PIECE_SYMBOLS = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟"
};

// These variables describe the current user-interface selection.
let selectedSquare = null;       // The square the player selected first.
let legalDestinations = [];      // Squares the selected piece may legally move to.
let boardIsFlipped = false;      // Whether Black is shown at the bottom.
let pendingPromotion = null;     // Stores a pawn move while promotion is chosen.

// ----------------------------------------------------------------
// 2. BOARD COORDINATES AND DISPLAY
// ----------------------------------------------------------------

/**
 * Return all 64 square names in the order they should appear.
 * Normal view: a8 to h1. Flipped view: h1 to a8.
 */
function getDisplaySquares() {
  const files = boardIsFlipped ? "hgfedcba" : "abcdefgh";
  const ranks = boardIsFlipped ? "12345678" : "87654321";

  // Build an array of 64 algebraic square names, e.g. ["a8", "b8", ...].
  return [...ranks].flatMap(rank => [...files].map(file => file + rank));
}

/**
 * Draw the current position and all visual markers.
 * The chess.js board is the source of truth; the HTML is rebuilt from it.
 */
function renderBoard() {
  // Clear the previous board display before drawing the current position.
  boardElement.innerHTML = "";

  // Get the current position as an 8 x 8 array from chess.js.
  const position = game.board();

  // Read the last move so its origin and destination can be highlighted.
  const moveHistory = game.history({ verbose: true });
  const lastMove = moveHistory.length ? moveHistory[moveHistory.length - 1] : null;
  const lastMoveSquares = lastMove ? [lastMove.from, lastMove.to] : [];

  // Create one button for each square in the selected orientation.
  for (const squareName of getDisplaySquares()) {
    // Convert algebraic notation (such as "e4") into array indexes.
    const fileIndex = squareName.charCodeAt(0) - 97;
    const rankIndex = 8 - Number(squareName[1]);
    const piece = position[rankIndex][fileIndex];

    // Each square is a button, making it clickable and keyboard accessible.
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

    // Alternate square colors. a8 is light and h1 is light.
    const isLightSquare = (fileIndex + rankIndex) % 2 === 1;
    squareButton.classList.add(isLightSquare ? "light" : "dark");

    // Mark the currently selected piece.
    if (selectedSquare === squareName) {
      squareButton.classList.add("selected");
    }

    // Shade the two squares involved in the previous move.
    if (lastMoveSquares.includes(squareName)) {
      squareButton.classList.add("last-move");
    }

    // If a piece occupies the square, add its Unicode symbol.
    if (piece) {
      const pieceElement = document.createElement("span");
      pieceElement.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      pieceElement.textContent = PIECE_SYMBOLS[piece.color + piece.type];
      squareButton.appendChild(pieceElement);
    }

    // Show a dot for a quiet move, or a ring for a capture.
    if (legalDestinations.includes(squareName)) {
      const marker = document.createElement("span");
      marker.className = piece ? "legal-capture" : "legal-dot";
      squareButton.appendChild(marker);
    }

    // Add rank labels along the left edge of the board.
    const isLeftEdge = boardIsFlipped ? fileIndex === 7 : fileIndex === 0;
    if (isLeftEdge) {
      const rankLabel = document.createElement("span");
      rankLabel.className = "coordinate rank";
      rankLabel.textContent = squareName[1];
      squareButton.appendChild(rankLabel);
    }

    // Add file labels along the bottom edge of the board.
    const isBottomEdge = boardIsFlipped ? rankIndex === 0 : rankIndex === 7;
    if (isBottomEdge) {
      const fileLabel = document.createElement("span");
      fileLabel.className = "coordinate file";
      fileLabel.textContent = squareName[0];
      squareButton.appendChild(fileLabel);
    }

    // Send square clicks to the central input handler.
    squareButton.addEventListener("click", () => handleSquareClick(squareName));

    // Add this square to the visible board.
    boardElement.appendChild(squareButton);
  }

  // Refresh all information panels after drawing the board.
  renderGameStatus();
  renderMoveHistory();

  // Undo is only available when at least one move has been played.
  undoButton.disabled = game.history().length === 0;
}

// ----------------------------------------------------------------
// 3. GAME STATUS: TURN, CHECK, CHECKMATE AND DRAWS
// ----------------------------------------------------------------

/**
 * Update the status panel using the chess rules library.
 * All game-ending decisions come from chess.js, not visual guesses.
 */
function renderGameStatus() {
  const sideToMove = game.turn() === "w" ? "White" : "Black";

  // Checkmate takes priority over all other status messages.
  if (game.isCheckmate()) {
    statusElement.textContent = `Checkmate — ${sideToMove === "White" ? "Black" : "White"} wins`;
    turnElement.textContent = "Game over";
    return;
  }

  // A stalemate is a draw: the player has no legal moves but is not in check.
  if (game.isStalemate()) {
    statusElement.textContent = "Draw — stalemate";
    turnElement.textContent = "Game over";
    return;
  }

  // Insufficient material means neither side can possibly checkmate.
  if (game.isInsufficientMaterial()) {
    statusElement.textContent = "Draw — insufficient material";
    turnElement.textContent = "Game over";
    return;
  }

  // Threefold repetition is a draw claim in tournament rules.
  if (game.isThreefoldRepetition()) {
    statusElement.textContent = "Draw — threefold repetition";
    turnElement.textContent = "Game over";
    return;
  }

  // Other draw conditions supported by chess.js.
  if (game.isDraw()) {
    statusElement.textContent = "Draw";
    turnElement.textContent = "Game over";
    return;
  }

  // If the game is still active, show whose turn it is and whether they are checked.
  turnElement.textContent = `${sideToMove} to move`;
  statusElement.textContent = game.isCheck()
    ? `${sideToMove} is in check`
    : "Game in progress";
}

// ----------------------------------------------------------------
// 4. MOVE HISTORY
// ----------------------------------------------------------------

/**
 * Render the game's SAN (algebraic) move list.
 * Example: 1. e4 e5 2. Nf3 Nc6
 */
function renderMoveHistory() {
  const moves = game.history();

  // Show a simple empty state before the first move.
  if (moves.length === 0) {
    historyElement.innerHTML = '<p class="empty-history">No moves yet.</p>';
    return;
  }

  historyElement.innerHTML = "";

  // Each row contains a move number, White's move and Black's move.
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

    // Highlight whichever move was played most recently.
    if (index === moves.length - 1) whiteMove.classList.add("latest");
    if (index + 1 === moves.length - 1) blackMove.classList.add("latest");

    historyElement.append(moveNumber, whiteMove, blackMove);
  }

  // Keep the newest move visible when the history becomes long.
  historyElement.scrollTop = historyElement.scrollHeight;
}

// ----------------------------------------------------------------
// 5. PLAYER INPUT AND LEGAL MOVES
// ----------------------------------------------------------------

/**
 * Handle a click on a board square.
 *
 * Flow:
 * 1. If a selected piece can legally move to this square, make that move.
 * 2. Otherwise, if this square contains the current player's piece, select it.
 * 3. Otherwise, clear the selection.
 */
function handleSquareClick(squareName) {
  // Do not accept moves after the game ends or while promotion is open.
  if (game.isGameOver() || pendingPromotion) return;

  const clickedPiece = game.get(squareName);

  // CASE 1: The player clicked a legal destination for the selected piece.
  if (selectedSquare && legalDestinations.includes(squareName)) {
    // Get legal moves from the selected square to the clicked destination.
    const candidateMoves = game.moves({ square: selectedSquare, verbose: true })
      .filter(move => move.to === squareName);

    // A pawn reaching the final rank has four legal promotion choices.
    const promotionMove = candidateMoves.find(move => move.promotion);
    if (promotionMove) {
      pendingPromotion = { from: selectedSquare, to: squareName };
      promotionDialog.classList.add("visible");
      return;
    }

    // chess.js validates and applies the move, then updates the game state.
    game.move({ from: selectedSquare, to: squareName });
    clearPieceSelection();
    renderBoard();
    return;
  }

  // CASE 2: The clicked square has a piece belonging to the player to move.
  if (clickedPiece && clickedPiece.color === game.turn()) {
    selectedSquare = squareName;

    // Ask chess.js for every legal move that piece can make.
    legalDestinations = game.moves({ square: squareName, verbose: true })
      .map(move => move.to);
  } else {
    // CASE 3: Empty square or opponent piece that is not a legal target.
    clearPieceSelection();
  }

  renderBoard();
}

/**
 * Clear all selection-related state.
 * This does not change the chess position.
 */
function clearPieceSelection() {
  selectedSquare = null;
  legalDestinations = [];
}

// ----------------------------------------------------------------
// 6. PAWN PROMOTION
// ----------------------------------------------------------------

// Attach one click handler to each promotion choice.
document.querySelectorAll("[data-promotion]").forEach(button => {
  button.addEventListener("click", () => {
    // A promotion choice is only meaningful when a pawn move is waiting.
    if (!pendingPromotion) return;

    // The selected data attribute is q, r, b or n.
    const promotionPiece = button.dataset.promotion;

    // Apply the promotion through chess.js so legality is still enforced.
    game.move({
      from: pendingPromotion.from,
      to: pendingPromotion.to,
      promotion: promotionPiece
    });

    // Close the dialog and clear temporary input state.
    pendingPromotion = null;
    promotionDialog.classList.remove("visible");
    clearPieceSelection();
    renderBoard();
  });
});

// ----------------------------------------------------------------
// 7. GAME CONTROLS
// ----------------------------------------------------------------

// Undo the previous half-move. Calling undo also restores special move state.
undoButton.addEventListener("click", () => {
  game.undo();
  closePromotionDialog();
  clearPieceSelection();
  renderBoard();
});

// Reset all pieces and game state to the standard starting position.
newGameButton.addEventListener("click", () => {
  game.reset();
  closePromotionDialog();
  clearPieceSelection();
  renderBoard();
});

// Flip the board view without changing the actual chess position.
flipButton.addEventListener("click", () => {
  boardIsFlipped = !boardIsFlipped;
  renderBoard();
});

// Remove selection highlights while leaving the game untouched.
clearButton.addEventListener("click", () => {
  clearPieceSelection();
  renderBoard();
});

/**
 * Shared helper for closing the promotion dialog.
 */
function closePromotionDialog() {
  pendingPromotion = null;
  promotionDialog.classList.remove("visible");
}

// ----------------------------------------------------------------
// 8. INITIALIZE THE APPLICATION
// ----------------------------------------------------------------

// Draw the standard starting position when the page loads.
renderBoard();

// ----------------------------------------------------------------
// 9. FUTURE ENGINE INTEGRATION — DEVELOPMENT NOTES
// ----------------------------------------------------------------
/*
 * Later, a computer opponent can be added without rewriting the board.
 *
 * Suggested extension:
 *
 * 1. Create a function such as chooseEngineMove(fen).
 * 2. Send game.fen() to your Python engine or a JavaScript engine.
 * 3. Receive a move in UCI format, for example "e2e4".
 * 4. Convert that UCI move into { from: "e2", to: "e4" }.
 * 5. Apply it with game.move(...), then call renderBoard().
 *
 * Keep the engine's move selection separate from the rules library.
 * chess.js checks whether a proposed move is legal; your future engine
 * will decide which legal move is strategically best.
 */
