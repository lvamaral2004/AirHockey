// script.js
const clientPaddle = document.getElementById('client-paddle');
const serverPaddle = document.getElementById('server-paddle');
const pucksContainer = document.getElementById('pucks-container');
const hitButton = document.getElementById('hit-button');
const resetButton = document.getElementById('reset-button');
const slowStartButton = document.getElementById('slow-start-button');
const stageTitle = document.getElementById('stage-title');
const stageDescription = document.getElementById('stage-description');
const logContainer = document.getElementById('log-container');
const socketState = document.getElementById('socket-state');
const sequenceInfo = document.getElementById('sequence-info');
const expectedSequence = document.getElementById('expected-sequence');
const confirmedCount = document.getElementById('confirmed-count');
const sequenceDisplay = document.getElementById('sequence-display');
const bufferArea = document.getElementById('buffer-area');
const bufferSequence = document.getElementById('buffer-sequence');
const windowControl = document.getElementById('window-control');
const windowFill = document.getElementById('window-fill');
const freeSpace = document.getElementById('free-space');
const congestionIndicator = document.getElementById('congestion-indicator');
const packetsInWindow = document.getElementById('packets-in-window');

let currentStage = 1;
let puckPositionX = 400;
let puckPositionY = 250;
let clientPaddleY = 210;
let serverPaddleY = 210;
let isClientMoving = false;
let puckAnimation = null;
let puckVelocityX = 0;
let puckVelocityY = 0;
let handshakeStep = 0;
let waitingForAck = false;

// Sistema de pacotes da Etapa 4
let packets = [];
let confirmedPackets = [];
let expectedOrder = [1, 2, 3, 4];
let packetTimeouts = {};
let isSendingPackets = false;

// Sistema da Etapa 5 - Controle de Fluxo
let windowPackets = [];
let windowSize = 10;
let currentWindowUsage = 0;
let packetCounter = 0;
let isCongested = false;
let slowStartActive = false;

clientPaddle.style.top = `${clientPaddleY}px`;
clientPaddle.style.left = `30px`;
serverPaddle.style.top = `${serverPaddleY}px`;

// Criar puck inicial
const puck = document.createElement('div');
puck.className = 'puck';
puck.id = 'main-puck';
puck.style.left = `${puckPositionX}px`;
puck.style.top = `${puckPositionY}px`;
pucksContainer.appendChild(puck);

function addLogEntry(message) {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearStageLogs() {
    const logs = logContainer.querySelectorAll('.log-entry');
    logs.forEach(log => {
        log.remove();
    });
}

function updateSocketState(state) {
    socketState.textContent = state;
}

function showResetButton() {
    resetButton.style.display = 'block';
}

function hideResetButton() {
    resetButton.style.display = 'none';
}

function showSlowStartButton() {
    slowStartButton.style.display = 'block';
}

function hideSlowStartButton() {
    slowStartButton.style.display = 'none';
}

function updateWindowDisplay() {
    const usagePercent = (currentWindowUsage / windowSize) * 100;
    windowFill.style.width = `${usagePercent}%`;
    freeSpace.textContent = `${100 - usagePercent}%`;
    packetsInWindow.textContent = `${currentWindowUsage}/${windowSize}`;
    
    if (usagePercent >= 80) {
        congestionIndicator.innerHTML = '<span class="congestion-warning">CONGESTIONAMENTO!</span>';
        isCongested = true;
        hitButton.disabled = true;
        showSlowStartButton();
    } else if (usagePercent >= 60) {
        congestionIndicator.textContent = 'Estado: Quase Cheio';
        isCongested = false;
    } else {
        congestionIndicator.textContent = 'Estado: Normal';
        isCongested = false;
    }
}

function toggleMainPuck() {
    const mainPuck = document.getElementById('main-puck');
    if (currentStage === 4 || currentStage === 5) {
        // Esconder o puck central nas etapas 4 e 5
        mainPuck.style.display = 'none';
    } else {
        // Mostrar o puck central nas etapas 1-3
        mainPuck.style.display = 'block';
    }
}

function resetStage() {
    // Parar todas as animações
    if (puckAnimation) {
        cancelAnimationFrame(puckAnimation);
        puckAnimation = null;
    }

    // Limpar timeouts dos pacotes
    Object.values(packetTimeouts).forEach(timeout => clearTimeout(timeout));
    packetTimeouts = {};

    // Parar animações dos pacotes
    packets.forEach(packet => {
        if (packet.animationId) {
            cancelAnimationFrame(packet.animationId);
        }
    });
    windowPackets.forEach(packet => {
        if (packet.animationId) {
            cancelAnimationFrame(packet.animationId);
        }
    });

    // Resetar variáveis globais
    isClientMoving = false;
    puckVelocityX = 0;
    puckVelocityY = 0;
    handshakeStep = 0;
    waitingForAck = false;
    isSendingPackets = false;

    // Resetar variáveis da Etapa 5
    currentWindowUsage = 0;
    packetCounter = 0;
    isCongested = false;
    slowStartActive = false;
    windowPackets = [];

    // Resetar posições
    puckPositionX = 400;
    puckPositionY = 250;
    clientPaddleY = 210;
    serverPaddleY = 210;

    clientPaddle.style.top = `${clientPaddleY}px`;
    clientPaddle.style.left = `30px`;
    serverPaddle.style.top = `${serverPaddleY}px`;
    
    // Resetar puck central
    const mainPuck = document.getElementById('main-puck');
    mainPuck.style.left = `${puckPositionX}px`;
    mainPuck.style.top = `${puckPositionY}px`;

    // Limpar pacotes
    packets = [];
    confirmedPackets = [];
    const allPucks = pucksContainer.querySelectorAll('.puck');
    allPucks.forEach(puck => {
        if (puck.id !== 'main-puck') {
            puck.remove();
        }
    });

    // Limpar logs da etapa
    clearStageLogs();

    // Atualizar display da janela
    updateWindowDisplay();

    // Controlar visibilidade do puck central
    toggleMainPuck();

    // Re-iniciar a etapa atual
    hitButton.disabled = false;
    
    switch(currentStage) {
        case 1:
            hitButton.textContent = "REBATER";
            startStage1();
            break;
        case 2:
            hitButton.textContent = "REBATER";
            startStage2();
            break;
        case 3:
            hitButton.textContent = "REBATER";
            startStage3();
            break;
        case 4:
            hitButton.textContent = "ENVIAR PACOTES";
            startStage4();
            break;
        case 5:
            hitButton.textContent = "ENVIAR PACOTE";
            startStage5();
            break;
    }
}

function startStage1() {
    currentStage = 1;
    stageTitle.textContent = "Etapa 1: Preparação";
    stageDescription.textContent = "O servidor está se preparando para aceitar conexões.";
    addLogEntry("ETAPA 1 INICIADA");
    updateSocketState("CLOSED");
    
    // Controlar visibilidade do puck central
    toggleMainPuck();
    
    // Esconder elementos das etapas posteriores
    sequenceInfo.style.display = 'none';
    bufferArea.style.display = 'none';
    windowControl.style.display = 'none';
    hideResetButton();
    hideSlowStartButton();

setTimeout(() => {
    updateSocketState("BOUND");
    addLogEntry("Operação BIND: o servidor associou o socket a porta 80 e ao IP 192.168.0.1");
    // O seu delay de 3s para o LISTEN começa aqui
    setTimeout(() => {
        updateSocketState("LISTEN");
        addLogEntry("Operação LISTEN: o servidor está na escuta e aguarda conexões de entrada");
        // O seu delay de 3s para o REBATER começa aqui
        setTimeout(() => {
            addLogEntry("Cliente quer se conectar? Se sim aperte o botão 'REBATER'");
            hitButton.disabled = false;
            showResetButton();
        }, 3000);
    }, 3000);
}, 3000);
}

function startStage2() {
    currentStage = 2;
    stageTitle.textContent = "Etapa 2: Endereçamento";
    stageDescription.textContent = "O cliente está configurando seu endereço para conectar ao servidor.";
    hitButton.disabled = true;
    addLogEntry("ETAPA 2 INICIADA");

    // Controlar visibilidade do puck central
    toggleMainPuck();
    
    // Esconder elementos das etapas posteriores
    sequenceInfo.style.display = 'none';
    bufferArea.style.display = 'none';
    windowControl.style.display = 'none';
    hideSlowStartButton();
    
    setTimeout(() => {
        addLogEntry("Cliente, seu IP é 192.168.0.5, e 49152 é sua porta");
        addLogEntry("Você deseja enviar pacotes para o servidor 192.168.0.1 de porta 80? Se sim clique em 'REBATER'");
        hitButton.disabled = false;
        showResetButton();
    }, 5000);
}

function startStage3() {
    currentStage = 3;
    handshakeStep = 0;
    stageTitle.textContent = "Etapa 3: Handshake";
    stageDescription.textContent = "Estabelecendo conexão através do three-way handshake.";
    hitButton.disabled = true;
    addLogEntry("ETAPA 3 INICIADA");

    // Controlar visibilidade do puck central
    toggleMainPuck();
    
    // Esconder elementos das etapas posteriores
    sequenceInfo.style.display = 'none';
    bufferArea.style.display = 'none';
    windowControl.style.display = 'none';
    hideSlowStartButton();
    
    setTimeout(() => {
        addLogEntry("Cliente, quer enviar uma solicitação SYN para iniciar a conexão? Se sim, clique em 'REBATER'");
        updateSocketState("SYN_SENT");
        hitButton.disabled = false;
        showResetButton();
    }, 5000);
}

function startStage4() {
    currentStage = 4;
    stageTitle.textContent = "Etapa 4: Confiabilidade";
    stageDescription.textContent = "Garantindo entrega ordenada e confiável dos pacotes.";
    updateSocketState("ESTABLISHED");
    addLogEntry("ETAPA 4 INICIADA");

    // Controlar visibilidade do puck central - ESCODER nas etapas 4 e 5
    toggleMainPuck();
    
    // Mostrar elementos da etapa 4
    sequenceInfo.style.display = 'block';
    bufferArea.style.display = 'block';
    windowControl.style.display = 'none';
    hideSlowStartButton();

    addLogEntry("O cliente enviará pacotes 1, 2, 3, 4 em sequência");
    addLogEntry("Usuário, você assume como servidor e deve rebater cada pacote como confirmação (ACK)");
    addLogEntry("Pacotes chegarão fora de ordem - observe o reordenamento!");
    
    setTimeout(() => {
        addLogEntry("Clique em 'ENVIAR PACOTES' para iniciar");
        hitButton.disabled = false;
        hitButton.textContent = "ENVIAR PACOTES";
        showResetButton();
    }, 2000);
    
    updateSequenceDisplay();
}

function startStage5() {
    currentStage = 5;
    stageTitle.textContent = "Etapa 5: Controle de Fluxo";
    stageDescription.textContent = "Gerenciando congestionamento com Janela Deslizante.";
    updateSocketState("ESTABLISHED");
    addLogEntry("ETAPA 5 INICIADA");
    
    // Controlar visibilidade do puck central - ESCODER nas etapas 4 e 5
    toggleMainPuck();
    
    // Mostrar elementos da etapa 5
    sequenceInfo.style.display = 'none';
    bufferArea.style.display = 'none';
    windowControl.style.display = 'block';
    hideSlowStartButton();

    addLogEntry("Usuário, você assume como cliente e servidor");
    addLogEntry("Enquanto cliente envie pacotes");
    addLogEntry("Enquanto servidor rebata o máximo que conseguir");
    addLogEntry("Use 'SLOW START' sair do congestionamento em uma menor taxa de envio");
    
    setTimeout(() => {
        addLogEntry("Clique em 'ENVIAR PACOTE' quantas vezes quiser");
        hitButton.disabled = false;
        hitButton.textContent = "ENVIAR PACOTE";
        showResetButton();
    }, 2000);
    
    updateWindowDisplay();
}

// ========== FUNÇÕES DAS ETAPAS 1-3 ==========

function clientHitPuck() {
    if (currentStage === 4) {
        sendPackets();
        return;
    }
    if (currentStage === 5) {
        sendWindowPacket();
        return;
    }
    
    if (isClientMoving) return;
    isClientMoving = true;
    hitButton.disabled = true;

    const clientStartX = parseInt(clientPaddle.style.left);
    const clientTargetX = puckPositionX - 20;
    const startY = parseInt(clientPaddle.style.top);
    const duration = 300;
    const startTime = performance.now();

    function animatePaddle(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const newX = clientStartX + (clientTargetX - clientStartX) * progress;
        clientPaddle.style.left = `${newX}px`;
        clientPaddle.style.top = `${puckPositionY}px`;

        if (progress < 1) {
            requestAnimationFrame(animatePaddle);
        } else {
            hitPuckTowardsServer();
        }
    }

    requestAnimationFrame(animatePaddle);
}

function hitPuckTowardsServer() {
    playHitSound();
    
    if (currentStage === 3) {
        if (handshakeStep === 0) {
            // SYN - Cliente para Servidor
            addLogEntry("Cliente enviou pacote SYN para o servidor");
            puckVelocityX = 15;
            puckVelocityY = 0;
            handshakeStep = 1;
            
            // Servidor rebate automaticamente quando a bola chegar nele
            const checkServerHit = setInterval(() => {
                if (puckPositionX >= 730 && !waitingForAck) {
                    clearInterval(checkServerHit);
                    serverReboundSynAck();
                }
                if (puckPositionX < 100) {
                    clearInterval(checkServerHit);
                }
            }, 50);
            
        } else if (handshakeStep === 2) {
            // ACK - Cliente confirma conexão
            addLogEntry("Cliente enviou pacote ACK confirmando a conexão");
            puckVelocityX = 15;
            puckVelocityY = 0;
            updateSocketState("ESTABLISHED");
            
            // Próxima etapa após conexão estabelecida
            setTimeout(() => {
                addLogEntry("Conexão TCP estabelecida com sucesso!");
                setTimeout(() => {
                    startStage4();
                }, 2000);
            }, 2000);
        }
    } else {
        // Para etapas 1 e 2, comportamento normal
        puckVelocityX = 15;
        puckVelocityY = 0;
    }
    
    animatePuck();
    resetClientPaddle();
}

function serverReboundSynAck() {
    // Servidor rebate a bola (SYN-ACK)
    puckVelocityX = -12;
    puckVelocityY = (250 - puckPositionY) * 0.1;
    addLogEntry("O servidor recebeu a solicitação e enviou seu próprio pacote SYN/ACK");
    updateSocketState("SYN_RCVD");
    playHitSound();
    waitingForAck = true;
    
    // Verificar quando a bola chegar no lado do cliente
    const checkClientSide = setInterval(() => {
        if (puckPositionX <= 100) {
            clearInterval(checkClientSide);
            stopPuckAtClient();
        }
    }, 50);
}

function stopPuckAtClient() {
    // Parar a bola no lado do cliente
    if (puckAnimation) {
        cancelAnimationFrame(puckAnimation);
        puckAnimation = null;
    }
    
    // Posicionar a bola perto do rebatedor do cliente
    puckPositionX = 80;
    const mainPuck = document.getElementById('main-puck');
    mainPuck.style.left = `${puckPositionX}px`;
    puckVelocityX = 0;
    puckVelocityY = 0;
    
    addLogEntry("Cliente, você confirma o recebimento do SYN-ACK? Se sim, clique em 'REBATER' para enviar um pacote ACK");
    hitButton.disabled = false;
    handshakeStep = 2; // Pronto para ACK
    waitingForAck = false;
}

function animatePuck() {
    function movePuck() {
        puckPositionX += puckVelocityX;
        puckPositionY += puckVelocityY;

        // Verificar colisão com as paredes superior e inferior
        if (puckPositionY <= 15 || puckPositionY >= 485) {
            puckVelocityY = -puckVelocityY;
            puckPositionY = puckPositionY <= 15 ? 16 : 484;
            playHitSound();
        }

        // Verificar se a bola saiu da mesa (gol)
        if (puckPositionX < 0 || puckPositionX > 800) {
            resetPuckToCenter();
            return;
        }

        const mainPuck = document.getElementById('main-puck');
        mainPuck.style.left = `${puckPositionX}px`;
        mainPuck.style.top = `${puckPositionY}px`;

        puckAnimation = requestAnimationFrame(movePuck);
    }
    movePuck();
}

// ========== ETAPA 4 - SISTEMA DE PACOTES ==========

function updateSequenceDisplay() {
    const sequenceNumbers = sequenceDisplay.querySelectorAll('.sequence-number');
    sequenceNumbers.forEach((el, index) => {
        const packetNum = index + 1;
        el.className = 'sequence-number';
        if (confirmedPackets.includes(packetNum)) {
            el.classList.add('received');
        } else if (packetNum === getNextExpectedPacket()) {
            el.classList.add('expected');
        }
    });
    confirmedCount.textContent = `${confirmedPackets.length}/4`;
}

function getNextExpectedPacket() {
    for (let i = 0; i < expectedOrder.length; i++) {
        if (!confirmedPackets.includes(expectedOrder[i])) {
            return expectedOrder[i];
        }
    }
    return null;
}

function createPacket(number) {
    const packet = document.createElement('div');
    packet.className = 'puck';
    packet.id = `packet-${number}`;
    packet.style.left = '100px';
    packet.style.top = `${150 + (number * 50)}px`;
    
    const numberElement = document.createElement('div');
    numberElement.className = 'puck-number';
    numberElement.textContent = number;
    
    packet.appendChild(numberElement);
    pucksContainer.appendChild(packet);
    
    return {
        element: packet,
        number: number,
        positionX: 100,
        positionY: 150 + (number * 50),
        velocityX: 0,
        velocityY: 0,
        confirmed: false,
        animationId: null
    };
}

function sendPackets() {
    if (isSendingPackets) return;
    
    isSendingPackets = true;
    hitButton.disabled = true;
    hitButton.textContent = "ENVIANDO...";
    packets = [];
    confirmedPackets = [];
    
    addLogEntry("Cliente enviando sequência de pacotes: 1, 2, 3, 4");
    
    // Criar pacotes com delays diferentes para simular ordem aleatória
    [2, 1, 4, 3].forEach((packetNum, index) => {
        setTimeout(() => {
            const packet = createPacket(packetNum);
            packets.push(packet);
            
            // Enviar pacote para o servidor
            setTimeout(() => {
                packet.velocityX = 8 + Math.random() * 2;
                packet.velocityY = (Math.random() - 0.5) * 3;
                animatePacket(packet);
                addLogEntry(`Pacote ${packetNum} enviado para o servidor`);
                
                // Iniciar timeout para retransmissão
                startPacketTimeout(packet);
            }, index * 800);
        }, index * 1000);
    });
}

function startPacketTimeout(packet) {
    packetTimeouts[packet.number] = setTimeout(() => {
        if (!packet.confirmed && packet.positionX < 400) {
            addLogEntry(`TIMEOUT: Pacote ${packet.number} não confirmado - retransmitindo`);
            retransmitPacket(packet);
        }
    }, 5000);
}

function retransmitPacket(packet) {
    // Resetar posição do pacote
    packet.positionX = 100;
    packet.positionY = 150 + (packet.number * 50);
    packet.velocityX = 8 + Math.random() * 2;
    packet.velocityY = (Math.random() - 0.5) * 3;
    packet.element.style.left = `${packet.positionX}px`;
    packet.element.style.top = `${packet.positionY}px`;
    
    // Reiniciar animação
    if (packet.animationId) {
        cancelAnimationFrame(packet.animationId);
    }
    animatePacket(packet);
    
    // Reiniciar timeout
    startPacketTimeout(packet);
}

function animatePacket(packet) {
    function movePacket() {
        packet.positionX += packet.velocityX;
        packet.positionY += packet.velocityY;

        // Colisão com paredes
        if (packet.positionY <= 15 || packet.positionY >= 485) {
            packet.velocityY = -packet.velocityY;
            packet.positionY = packet.positionY <= 15 ? 16 : 484;
        }

        // Colisão com servidor (confirmação)
        const serverTop = parseInt(serverPaddle.style.top);
        const serverBottom = serverTop + 80;
        
        if (packet.positionX >= 730 && packet.positionX <= 750 &&
            packet.positionY >= serverTop && packet.positionY <= serverBottom) {
            
            packet.velocityX = -6;
            packet.velocityY = (serverTop + 40 - packet.positionY) * 0.1;
            confirmPacket(packet);
        }

        // Verificar se pacote saiu da mesa
        if (packet.positionX > 800 || packet.positionX < 0) {
            if (packet.animationId) {
                cancelAnimationFrame(packet.animationId);
                packet.animationId = null;
            }
            return;
        }

        packet.element.style.left = `${packet.positionX}px`;
        packet.element.style.top = `${packet.positionY}px`;

        packet.animationId = requestAnimationFrame(movePacket);
    }
    movePacket();
}

function confirmPacket(packet) {
    if (packet.confirmed) return;
    
    packet.confirmed = true;
    clearTimeout(packetTimeouts[packet.number]);
    
    // Adicionar à lista de confirmados (mas manter ordem de chegada)
    confirmedPackets.push(packet.number);
    
    addLogEntry(`ACK: Pacote ${packet.number} confirmado pelo servidor`);
    
    // Atualizar buffer de reordenamento
    updateBufferDisplay();
    
    // Verificar se todos foram confirmados
    if (confirmedPackets.length === 4) {
        checkSequenceOrder();
    }
    
    updateSequenceDisplay();
}

function updateBufferDisplay() {
    bufferSequence.textContent = confirmedPackets.join(', ');
}

function checkSequenceOrder() {
    addLogEntry("Todos os pacotes foram recebidos!");
    
    // Verificar se estão na ordem correta
    const isInOrder = JSON.stringify(confirmedPackets) === JSON.stringify([1, 2, 3, 4]);
    
    if (isInOrder) {
        addLogEntry("Sequência correta! Dados entregues perfeitamente");
        setTimeout(() => {
            startStage5();
        }, 3000);
    } else {
        addLogEntry("Pacotes fora de ordem! Reordenando...");
        setTimeout(() => {
            confirmedPackets.sort((a, b) => a - b);
            updateBufferDisplay();
            updateSequenceDisplay();
            addLogEntry("Reordenamento concluído! Sequência: " + confirmedPackets.join(', '));
            setTimeout(() => {
                startStage5();
            }, 3000);
        }, 2000);
    }
}

function sendWindowPacket() {
    if (currentWindowUsage >= windowSize) {
        addLogEntry("Janela cheia! Não e possivel enviar mais pacotes");
        return;
    }

    packetCounter++;
    currentWindowUsage++;
    
    const packet = createPacket(packetCounter);
    windowPackets.push(packet);
    
    addLogEntry(`Pacote ${packetCounter} enviado. Janela: ${currentWindowUsage}/${windowSize}`);
    
    // Enviar pacote para o servidor
    packet.velocityX = 8 + Math.random() * 2;
    packet.velocityY = (Math.random() - 0.5) * 3;
    animateWindowPacket(packet);
    
    updateWindowDisplay();
    
    // Se a janela estiver cheia, desabilitar envio
    if (currentWindowUsage >= windowSize) {
        hitButton.disabled = true;
        addLogEntry("Congestionamento! Use 'SLOW START' para recuperar.");
    }
}

function animateWindowPacket(packet) {
    function movePacket() {
        packet.positionX += packet.velocityX;
        packet.positionY += packet.velocityY;

        // Colisão com paredes
        if (packet.positionY <= 15 || packet.positionY >= 485) {
            packet.velocityY = -packet.velocityY;
            packet.positionY = packet.positionY <= 15 ? 16 : 484;
        }

        // Colisão com servidor (confirmação)
        const serverTop = parseInt(serverPaddle.style.top);
        const serverBottom = serverTop + 80;
        
        if (packet.positionX >= 730 && packet.positionX <= 750 &&
            packet.positionY >= serverTop && packet.positionY <= serverBottom) {
            
            // ACK - Servidor processou o pacote
            packet.velocityX = -6;
            packet.velocityY = (serverTop + 40 - packet.positionY) * 0.1;
            processWindowAck(packet);
        }

        // Verificar se pacote saiu da mesa (timeout)
        if (packet.positionX > 800) {
            if (packet.animationId) {
                cancelAnimationFrame(packet.animationId);
                packet.animationId = null;
            }
            // Pacote perdido - não diminui a janela
            addLogEntry(`Pacote ${packet.number} perdido (timeout)`);
            return;
        }

        packet.element.style.left = `${packet.positionX}px`;
        packet.element.style.top = `${packet.positionY}px`;

        packet.animationId = requestAnimationFrame(movePacket);
    }
    movePacket();
}

function processWindowAck(packet) {
    currentWindowUsage--;
    addLogEntry(`ACK: Pacote ${packet.number} processado. Janela: ${currentWindowUsage}/${windowSize}`);
    
    // Remover pacote da lista
    const index = windowPackets.indexOf(packet);
    if (index > -1) {
        windowPackets.splice(index, 1);
    }
    
    // Remover elemento visual após um tempo
    setTimeout(() => {
        if (packet.element.parentNode) {
            packet.element.remove();
        }
    }, 1000);
    
    updateWindowDisplay();
    
    // Se saiu do estado de congestionamento, reabilitar envio
    if (currentWindowUsage < windowSize && !slowStartActive) {
        hitButton.disabled = false;
    }
}

function activateSlowStart() {
    if (!isCongested) return;
    
    slowStartActive = true;
    windowSize = 5; // Reduz tamanho da janela
    currentWindowUsage = 0; // Limpa a janela
    hitButton.disabled = false;
    
    addLogEntry("Slow start ativado! Taxa de envio reduzida para 5 pacotes");
    
    // Limpar pacotes pendentes
    windowPackets.forEach(packet => {
        if (packet.animationId) {
            cancelAnimationFrame(packet.animationId);
        }
        if (packet.element.parentNode) {
            packet.element.remove();
        }
    });
    windowPackets = [];
    
    updateWindowDisplay();
    hideSlowStartButton();
    
    // Restaurar janela normal após alguns ACKs
    setTimeout(() => {
        if (currentWindowUsage <= 3) {
            windowSize = 10;
            slowStartActive = false;
            addLogEntry("Janela normal restaurada (10 pacotes)");
            updateWindowDisplay();
        }
    }, 10000);
}

// ========== FUNÇÕES GERAIS ==========

function playHitSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 300;
    oscillator.type = 'square';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function resetClientPaddle() {
    const startY = parseInt(clientPaddle.style.top);
    const startX = parseInt(clientPaddle.style.left);
    const targetY = 210;
    const targetX = 30;
    const duration = 400;
    const startTime = performance.now();

    function animateReturn(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const newY = startY + (targetY - startY) * progress;
        const newX = startX + (targetX - startX) * progress;
        clientPaddle.style.top = `${newY}px`;
        clientPaddle.style.left = `${newX}px`;

        if (progress < 1) {
            requestAnimationFrame(animateReturn);
        } else {
            isClientMoving = false;
            clientPaddleY = targetY;
        }
    }

    requestAnimationFrame(animateReturn);
}

function resetPuckToCenter() {
    if (puckAnimation) {
        cancelAnimationFrame(puckAnimation);
        puckAnimation = null;
    }
    puckPositionX = 400;
    puckPositionY = 250;
    puckVelocityX = 0;
    puckVelocityY = 0;
    const mainPuck = document.getElementById('main-puck');
    mainPuck.style.left = `${puckPositionX}px`;
    mainPuck.style.top = `${puckPositionY}px`;
}

// Controle do servidor com mouse (etapas 4 e 5)
document.addEventListener('mousemove', function(e) {
    if (currentStage !== 4 && currentStage !== 5) return;
    
    const tableRect = document.querySelector('.table').getBoundingClientRect();
    const mouseY = e.clientY - tableRect.top;
    
    // Atualizar posição do rebatedor do servidor
    serverPaddleY = Math.max(10, Math.min(mouseY - 40, 410));
    serverPaddle.style.top = `${serverPaddleY}px`;
});

hitButton.addEventListener('click', function() {
    if (currentStage === 1) {
        clientHitPuck();
        setTimeout(startStage2, 2000);
    } else if (currentStage === 2) {
        addLogEntry("Tupla montada");
        addLogEntry("IP origem: 192.168.0.5 | PORTA origem: 49152");
        addLogEntry("IP destino: 192.168.0.1 | PORTA destino: 80");
        clientHitPuck();
        setTimeout(startStage3, 2000);
    } else if (currentStage === 3) {
        if (handshakeStep === 0) {
            addLogEntry("Cliente enviando pacote SYN...");
            clientHitPuck();
        } else if (handshakeStep === 2) {
            addLogEntry("Cliente enviando pacote ACK...");
            clientHitPuck();
        }
    } else if (currentStage === 4) {
        sendPackets();
    } else if (currentStage === 5) {
        sendWindowPacket();
    }
});

resetButton.addEventListener('click', function() {
    resetStage();
});

slowStartButton.addEventListener('click', function() {
    activateSlowStart();
});

function moveServerPaddle() {
    if (currentStage === 4 || currentStage === 5) return;
    
    const targetY = puckPositionY - 40;
    const currentY = parseInt(serverPaddle.style.top);
    const diff = targetY - currentY;
    serverPaddleY = currentY + diff * 0.08;
    serverPaddleY = Math.max(10, Math.min(serverPaddleY, 410));
    serverPaddle.style.top = `${serverPaddleY}px`;
    requestAnimationFrame(moveServerPaddle);
}

// Iniciar o jogo
startStage1();
moveServerPaddle();