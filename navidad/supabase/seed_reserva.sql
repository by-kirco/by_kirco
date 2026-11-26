-- by_kirco · Navidad — cartas de reserva
-- Ejecutar UNA SOLA VEZ en el SQL Editor de Supabase, después de schema.sql.
-- 20 cartas ya escritas y aprobadas de antemano, sin remitente real, para cuando el reparto
-- (fase futura) necesite dar una carta a alguien que, de otro modo, se quedaría sin una.
-- Por lo general no se usan. Firman como "Kirco" al entregarse.

insert into cartas_reserva (tema, texto) values
('Una frase que esa persona pueda guardar, si este año se le ha hecho largo.', $$Hay años que se hacen largos. No sé si el tuyo ha sido uno de ellos, y no hace falta que me lo cuentes.

Por si lo ha sido, o por si algún día lo es, te dejo una frase para llevar en el bolsillo: lo que hoy pesa no tiene por qué pesar siempre igual.

No es un consejo ni una promesa. Es algo que me gusta recordar cuando los días se alargan, y hoy quería que también lo tuvieras tú.

Y si tu año ha sido bueno, guárdala igualmente. Las frases bonitas no caducan.$$),

('Que está bien llegar a estas fechas sin tenerlo todo resuelto.', $$Estas fechas tienen la costumbre de pedirnos cuentas: cómo vas, qué has conseguido, qué planes tienes. Como si hubiera que llegar a diciembre con todo en orden.

No hace falta. Se puede llegar con cosas a medias, con preguntas sin respuesta, con algún cajón sin ordenar, de los de casa o de los otros.

Yo también llego así, y aquí estoy, escribiéndote. Puedes llegar como llegues. Esta carta te recibe igual.$$),

('Lo que le dirías a alguien que se ha esforzado y nadie se lo ha dicho.', $$Hace frío por aquí, de ese que pide quedarse en casa con algo caliente entre las manos. Te escribo así, con los dedos fríos y la calefacción haciendo ruido.

No sé qué has hecho este año, ni cuánto te ha costado. Pero sé que mucha gente se esfuerza sin que nadie lo vea, y que casi nunca se lo dicen.

Así que, por si a ti tampoco te lo han dicho: lo que has hecho cuenta, aunque nadie lo haya visto. Y lo que has aguantado, también.

Feliz Navidad, o feliz lo que tú quieras que sean estos días.$$),

('Un deseo pequeño para quien va a leerte, no un propósito grande.', $$No te voy a desear nada grande. Los deseos grandes a veces pesan, como si hubiera que estar a su altura.

Te deseo algo pequeño: que estos días te toque un rato de sol en la cara, una comida que te sepa bien y alguna noche en la que duermas del tirón.

Si se cumple aunque sea una de las tres, ya me parecerá bastante. Y si no, que por lo menos esta carta cuente como algo pequeño y bueno.$$),

('Que esta Navidad no tiene que parecerse a ninguna otra para valer.', $$Esta tarde he paseado por una calle llena de luces. Había quien se paraba a hacer fotos y quien pasaba deprisa, con la cabeza en otra parte. Y he pensado que las dos cosas también son Navidad.

Por eso no te voy a decir cómo tienen que ser tus fiestas. Pueden ser grandes, pequeñas, raras o tranquilas. Pueden parecerse a las de otros años o a ninguna, y valen igual.

Solo quería que supieras que, entre todas las cartas que salen estos días, una ha salido pensando en ti. Sin conocerte, sí, pero con las mismas ganas que si te conociera.

Un abrazo de papel.$$),

('Un «he pensado en ti» para quien sienta que pasa desapercibido.', $$Hay personas que pasan por los días sin que nadie se fije demasiado: hacen lo suyo, están ahí, y casi nadie se para a decirles nada. No sé si a veces te sientes así.

Por si es el caso, quería decírtelo con todas las letras: he pensado en ti. No en alguien en general. En ti, en quien está leyendo esto ahora.

No te conozco, y aun así me he sentado a escribirte con calma. Me apetecía que lo supieras.$$),

('Que no hace falta estar alegre para merecer una carta.', $$Esta carta no lleva espumillón ni villancicos. Te la escribo así, sin adornos, porque no sé si a ti te apetecen.

Hay quien vive estas fechas con muchas ganas y hay quien solo espera que pasen. Las dos formas están bien.

No hace falta estar alegre para recibir una carta. Ni para leerla, ni para guardarla. Esta es tuya igual, estés como estés hoy.$$),

('Algo tierno para quien echa de menos a alguien estas fiestas, sin intentar consolar de más.', $$Estas fechas tienen algo curioso: hacen que se note más quién está y también quién falta. Si a ti te pasa, le pasa a mucha gente, y no tienes que esconderlo para que los demás estén bien.

Y si no te pasa, guarda estas líneas por si algún día le hacen falta a alguien a quien quieres.

Yo no puedo sentarme a tu lado, pero sí puedo dejarte esta carta. Es lo que mejor sé hacer: escribir para alguien que no conozco y esperar que le llegue en buen momento.

Que estos días te traten con cuidado.$$),

('Un permiso para no poder con todo en diciembre.', $$Diciembre suele venir con prisa: compras, comidas, mensajes, planes. Como si hubiera que llegar a todo.

Por si nadie te lo ha dicho este mes, te lo digo yo: no tienes que poder con todo. Se puede decir que no a algo, dejar algo para enero o parar un rato sin dar explicaciones.

Y si tu diciembre va despacio, mejor todavía: esta carta encaja bien con los días lentos.$$),

('Lo que te habría gustado recibir tú, escrito ahora para esa persona.', $$Si pienso en lo que me habría gustado recibir algún diciembre, no es nada caro ni grande. Es una carta que dijera, sin más: estoy aquí, me he acordado de ti, no tienes que contarme nada.

Sin consejos, sin preguntas, sin esperar respuesta.

Así que hoy la escribo yo, para ti. No sé cómo es tu diciembre, pero si en algún momento te hace falta, aquí la tienes: estoy aquí, me he acordado de ti, y no tienes que contarme nada.$$),

('Lo que le dirías a alguien que necesita un rato de calma en medio de estas fiestas.', $$Hoy llueve, y la calle está llena de paraguas que se esquivan unos a otros. Desde la ventana parece un baile un poco torpe.

Me gustan los días así para escribir. Todo va más despacio y las palabras salen con más calma.

Te mando esa calma en esta carta, para que, sea el día que sea cuando la leas, tengas un momento tranquilo, de esos que se parecen a mirar llover.$$),

('Escríbele como quien le acerca una taza y le dice que puede quedarse un rato.', $$Hoy me he preparado un té y lo he dejado enfriar mientras pensaba qué contarte. Al final se me ha quedado tibio, como casi siempre.

Me gusta imaginar que estás leyendo esto en algún sitio tuyo: un sofá, un autobús, la cama antes de dormir. Da igual dónde. Haz como si te acercara una taza: aquí no hay prisa.

No sé qué traes contigo estos días. Puede que sea alegría, puede que sea cansancio, puede que sean las dos cosas a la vez, que también pasa. Todo cabe aquí.

Si te apetece, quédate un rato. Yo me quedo contigo mientras dure la carta.$$),

('Un olor, un sabor o un calor de estas fechas, escrito para que lo sienta quien te lea.', $$Te cuento algo pequeño: esta mañana olía a castañas asadas al salir de casa. Ese olor a humo dulce que se te queda en el abrigo y te calienta un poco las manos solo con pasar cerca.

Creo que lo bonito de estas fechas suele estar en cosas así, que no salen en ningún anuncio: el vaho en un cristal, una canción que suena de fondo, alguien que te guarda el último trozo de algo.

No sé cuáles son las tuyas. Pero te mando ese olor en esta carta, por si te llega aunque sea un poco.$$),

('Lo que le dirías a alguien que este año ha tenido que ser fuerte más veces de las que habría querido.', $$Hay años en los que toca ser fuerte más veces de las que una persona querría. No sé si este ha sido así para ti, y si lo ha sido, no hace falta que me lo cuentes.

Solo quería decirte algo que a veces se olvida: ser fuerte cansa. Y que te canse no quiere decir que lo hayas hecho mal.

En esta carta no tienes que aguantar nada. Puedes leerla con los hombros bajados, sin demostrar nada a nadie. Mientras duran estas líneas, el peso puede quedarse en el suelo un rato.$$),

('Que, cuando abra esta carta, esa persona no estará sola, aunque la lea en silencio.', $$Ahora mismo, mientras lees, esta carta solo existe para ti. Puede que la estés leyendo en silencio, sin nadie cerca. Aun así, al otro lado de estas líneas hay alguien que pensó en este momento mientras las escribía.

Me gusta pensar en eso: con lo deprisa que va todo estos días, aquí hay unas líneas que van a tu ritmo y te hacen compañía.

Léela despacio si quieres. Y luego sigue con lo tuyo, sea lo que sea.$$),

('Una sola cosa bella que hayas visto estos días, contada para que la reciba esa persona, no para hablar de ti.', $$Desde donde escribo se ven los tejados, y a última hora de la tarde se ponen de un color naranja que dura muy poco. Si tardas en mirar, te lo pierdes.

Hoy lo he visto entero, de principio a fin, y he pensado que quería contártelo. No para hablar de mí, sino para que te llegue a ti también, aunque sea así, a través de unas líneas.

Que algo de ese naranja te alcance estos días. Un poco de calor en pleno invierno, de parte de alguien que no conoces.$$),

('Que merece el mismo cuidado que suele dar.', $$Hay personas que pasan estas fechas pendientes de todo: de los regalos, de la comida, de que a nadie le falte nada. No sé si eres una de ellas.

Si lo eres, esta carta va al revés: aquí no tienes que hacer nada por nadie. Es solo para ti. Mereces el mismo cuidado que das, aunque a veces se te olvide.

Y si no lo eres, también es para ti. Recibir algo sin motivo es una de las cosas más bonitas que conozco, y hoy te toca a ti.$$),

('Un deseo para el año que entra que no le pida cambiar, solo que le vaya un poco más suave.', $$Para el año que viene no te deseo grandes cambios. Te deseo cosas más pequeñas: días que se te hagan un poco más suaves, alguna conversación que te deje buen sabor de boca y, de vez en cuando, un rato en el que no tengas que demostrar nada.

No sé cómo ha sido este año para ti, así que no te voy a decir que lo dejes atrás. A lo mejor quieres quedarte con mucho de él.

Lo único que te deseo es que el que entra te vaya un poco más suave. Así, tal como eres.$$),

('Lo que le dirías a alguien que se siente fuera de sitio en las reuniones de estas fechas.', $$En estas fechas hay muchas comidas largas, muchas conversaciones a la vez y muchas preguntas de las de siempre. Hay quien disfruta en medio de todo eso y hay quien, en algún momento, siente que no encaja del todo.

Si alguna vez te pasa, no quiere decir que haya nada raro en ti. A veces el sitio no es el tuyo esa noche, y ya está.

Esta carta sí es un sitio tuyo. Aquí no hay que dar conversación ni contestar a ninguna pregunta. Puedes volver a ella cuando te apetezca.$$),

('Algo que le pueda sacar una sonrisa al abrirla, sin pedirle que esté de fiesta.', $$Hace unos días sonaban por todas partes los niños cantando los números de la lotería. Es uno de esos sonidos que dicen, sin necesidad de calendario, que ya es Navidad.

No sé si te tocó algo. Lo más probable es que no, como a casi todo el mundo.

Así que aquí va mi pequeño premio: una carta escrita para ti, que no hace falta compartir con nadie ni cobrar en ninguna ventanilla. Y que no te pide estar de fiesta para abrirla.$$);
