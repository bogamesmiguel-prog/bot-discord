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
  "3v3": [],
  "4v4": [],
};

const tamanhoPartida = {
  "1v1-mobile": 2,
  "1v1-emu": 2,
  "2v2": 4,
  "3v3": 6,
  "4v4": 8,
};

const valores = {
  "1v1-mobile": "R$ 1",
  "1v1-emu": "R$ 1",
  "2v2": "R$ 2",
  "3v3": "R$ 3",
  "4v4": "R$ 6",
};

function nomeBonitoFila(tipo) {
  const nomes = {
    "1v1-mobile": "1v1 Mobile",
    "1v1-emu": "1v1 Emulador",
    "2v2": "2v2",
    "3v3": "3v3",
    "4v4": "4v4",
  };
  return nomes[tipo];
}

function formatarFila(tipo) {
  return filas[tipo].length
    ? filas[tipo].map((u, i) => `${i + 1}. ${u}`).join("\n")
    : "Fila vazia";
}

function criarEmbedPainel(tipo) {
  return new EmbedBuilder()
    .setTitle(`PAINEL ${nomeBonitoFila(tipo)}`)
    .addFields(
      { name: "Valor", value: valores[tipo], inline: true },
      { name: "Fecha com", value: `${tamanhoPartida[tipo]} jogadores`, inline: true },
      { name: "Fila atual", value: formatarFila(tipo) }
    );
}

function criarBotoesPainel(tipo) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`entrar_${tipo}`)
        .setLabel("Entrar")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`sair_${tipo}`)
        .setLabel("Sair")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId(`ver_${tipo}`)
        .setLabel("Fila")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function pegarCategoria(guild) {
  let cat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === "PARTIDAS"
  );

  if (!cat) {
    cat = await guild.channels.create({
      name: "PARTIDAS",
      type: ChannelType.GuildCategory,
    });
  }

  return cat;
}

function separarTimes(jogadores) {
  const metade = jogadores.length / 2;

  return {
    vermelho: jogadores.slice(0, metade),
    azul: jogadores.slice(metade),
  };
}

async function criarPartida(guild, tipo, jogadores) {
  const categoria = await pegarCategoria(guild);

  const canal = await guild.channels.create({
    name: `partida-${contadorPartidas}`,
    type: ChannelType.GuildText,
    parent: categoria.id,
  });

  contadorPartidas++;

  const { vermelho, azul } = separarTimes(jogadores);

  await canal.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(`🔥 ${nomeBonitoFila(tipo)}`)
        .setDescription(`Valor: ${valores[tipo]}`)
        .addFields(
          {
            name: "🔴 Time Vermelho",
            value: vermelho.map((u) => `<@${u}>`).join("\n"),
            inline: true,
          },
          {
            name: "🔵 Time Azul",
            value: azul.map((u) => `<@${u}>`).join("\n"),
            inline: true,
          }
        ),
    ],
  });
}

async function verificarFila(guild, tipo, canal) {
  if (filas[tipo].length >= tamanhoPartida[tipo]) {
    const jogadores = filas[tipo].splice(0, tamanhoPartida[tipo]);
    await criarPartida(guild, tipo, jogadores);
    canal.send("Partida criada automaticamente.");
  }
}

client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith(prefix)) return;

  const cmd = msg.content.slice(prefix.length).toLowerCase();

  if (cmd === "painelmobile")
    msg.channel.send({
      embeds: [criarEmbedPainel("1v1-mobile")],
      components: criarBotoesPainel("1v1-mobile"),
    });

  if (cmd === "painelemu")
    msg.channel.send({
      embeds: [criarEmbedPainel("1v1-emu")],
      components: criarBotoesPainel("1v1-emu"),
    });

  if (cmd === "painel2v2")
    msg.channel.send({
      embeds: [criarEmbedPainel("2v2")],
      components: criarBotoesPainel("2v2"),
    });

  if (cmd === "painel3v3")
    msg.channel.send({
      embeds: [criarEmbedPainel("3v3")],
      components: criarBotoesPainel("3v3"),
    });

  if (cmd === "painel4v4")
    msg.channel.send({
      embeds: [criarEmbedPainel("4v4")],
      components: criarBotoesPainel("4v4"),
    });

  if (cmd.startsWith("sala")) {
    const args = msg.content.split(" ");
    msg.channel.send(`Sala ID: ${args[1]} | Senha: ${args[2]}`);
  }

  if (cmd === "finalizar") {
    if (msg.channel.name.startsWith("partida"))
      setTimeout(() => msg.channel.delete(), 4000);
  }
});

client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  const tipo = i.customId.split("_")[1];
  const user = i.user.id;

  if (i.customId.startsWith("entrar")) {
    filas[tipo].push(user);
    await i.reply({ content: "Entrou na fila", ephemeral: true });
    verificarFila(i.guild, tipo, i.channel);
  }

  if (i.customId.startsWith("sair")) {
    filas[tipo] = filas[tipo].filter((u) => u !== user);
    i.reply({ content: "Saiu da fila", ephemeral: true });
  }

  if (i.customId.startsWith("ver")) {
    i.reply({ embeds: [criarEmbedPainel(tipo)], ephemeral: true });
  }
});

client.login(process.env.TOKEN);