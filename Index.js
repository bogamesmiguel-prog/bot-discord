require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const prefix = "!";
let contadorPartidas = 1;

const filas = {
  "1v1-mobile": [],
  "1v1-emu": [],
  "2v2": [],
  "4v4": [],
};

const tamanhoPartida = {
  "1v1-mobile": 2,
  "1v1-emu": 2,
  "2v2": 4,
  "4v4": 8,
};

function nomeUsuario(user) {
  return user.globalName || user.username;
}

function usuarioJaEstaEmAlgumaFila(userId) {
  for (const tipo in filas) {
    if (filas[tipo].some((u) => u.id === userId)) {
      return tipo;
    }
  }
  return null;
}

function removerDeTodasAsFilas(userId) {
  for (const tipo in filas) {
    const index = filas[tipo].findIndex((u) => u.id === userId);
    if (index !== -1) {
      filas[tipo].splice(index, 1);
    }
  }
}

function formatarFila(tipo) {
  return filas[tipo].length > 0
    ? filas[tipo].map((u, i) => `${i + 1}. ${u.nome}`).join("\n")
    : "Fila vazia";
}

function criarEmbedPainel(tipo) {
  const titulos = {
    "1v1-mobile": "PAINEL 1v1 MOBILE",
    "1v1-emu": "PAINEL 1v1 EMULADOR",
    "2v2": "PAINEL 2v2",
    "4v4": "PAINEL 4v4",
  };

  return new EmbedBuilder()
    .setTitle(titulos[tipo])
    .setDescription("Clique no botão para entrar ou sair da fila.")
    .addFields({
      name: "Fila atual",
      value: formatarFila(tipo),
      inline: false,
    });
}

function criarBotoesPainel(tipo) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`entrar_${tipo}`)
        .setLabel("Entrar na fila")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`sair_${tipo}`)
        .setLabel("Sair da fila")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ver_${tipo}`)
        .setLabel("Ver fila")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function pegarOuCriarCategoriaPartidas(guild) {
  let categoria = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === "PARTIDAS"
  );

  if (!categoria) {
    categoria = await guild.channels.create({
      name: "PARTIDAS",
      type: ChannelType.GuildCategory,
    });
  }

  return categoria;
}

async function criarCanalDePartida(guild, tipoFila, jogadores) {
  const categoria = await pegarOuCriarCategoriaPartidas(guild);
  const nomeCanal = `partida-${contadorPartidas}`;
  contadorPartidas++;

  const canal = await guild.channels.create({
    name: nomeCanal,
    type: ChannelType.GuildText,
    parent: categoria.id,
  });

  const listaJogadores = jogadores.map((j) => `<@${j.id}>`).join("\n");

  await canal.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`Partida criada: ${nomeCanal}`)
        .setDescription(`**Modo:** ${tipoFila}\n\n**Jogadores:**\n${listaJogadores}`),
    ],
  });

  return canal;
}

async function verificarFechamentoFila(guild, tipoFila, canalResposta = null) {
  const minimo = tamanhoPartida[tipoFila];

  while (filas[tipoFila].length >= minimo) {
    const jogadoresDaPartida = filas[tipoFila].splice(0, minimo);
    const canalPartida = await criarCanalDePartida(guild, tipoFila, jogadoresDaPartida);

    if (canalResposta) {
      await canalResposta.send(`Partida fechada em **${tipoFila}**. Canal criado: ${canalPartida}`);
    }
  }
}

client.once("clientReady", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const comando = args.shift().toLowerCase();

  if (comando === "painelmobile") {
    return message.channel.send({
      embeds: [criarEmbedPainel("1v1-mobile")],
      components: criarBotoesPainel("1v1-mobile"),
    });
  }

  if (comando === "painelemu") {
    return message.channel.send({
      embeds: [criarEmbedPainel("1v1-emu")],
      components: criarBotoesPainel("1v1-emu"),
    });
  }

  if (comando === "painel2v2") {
    return message.channel.send({
      embeds: [criarEmbedPainel("2v2")],
      components: criarBotoesPainel("2v2"),
    });
  }

  if (comando === "painel4v4") {
    return message.channel.send({
      embeds: [criarEmbedPainel("4v4")],
      components: criarBotoesPainel("4v4"),
    });
  }

  if (comando === "limparfilas") {
    const temPermissao = message.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

    if (!temPermissao) {
      return message.reply("você não tem permissão para limpar as filas.");
    }

    for (const tipo in filas) {
      filas[tipo] = [];
    }

    return message.reply("todas as filas foram limpas.");
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const user = interaction.user;
  const nome = nomeUsuario(user);
  const id = interaction.customId;

  if (id.startsWith("entrar_")) {
    const tipo = id.replace("entrar_", "");
    const filaAtual = usuarioJaEstaEmAlgumaFila(user.id);

    if (filaAtual) {
      return interaction.reply({
        content: `você já está na fila **${filaAtual}**.`,
        ephemeral: true,
      });
    }

    filas[tipo].push({ id: user.id, nome });

    await interaction.reply({
      content: `você entrou na fila **${tipo}**.\nPosição: **${filas[tipo].length}**`,
      ephemeral: true,
    });

    return verificarFechamentoFila(interaction.guild, tipo, interaction.channel);
  }

  if (id.startsWith("sair_")) {
    const tipo = id.replace("sair_", "");
    const index = filas[tipo].findIndex((u) => u.id === user.id);

    if (index === -1) {
      return interaction.reply({
        content: "você não está nessa fila.",
        ephemeral: true,
      });
    }

    filas[tipo].splice(index, 1);

    return interaction.reply({
      content: `você saiu da fila **${tipo}**.`,
      ephemeral: true,
    });
  }

  if (id.startsWith("ver_")) {
    const tipo = id.replace("ver_", "");

    return interaction.reply({
      embeds: [criarEmbedPainel(tipo)],
      ephemeral: true,
    });
  }
});

client.login(process.env.TOKEN);