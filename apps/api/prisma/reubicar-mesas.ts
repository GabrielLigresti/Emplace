// Script único de reubicación de mesas, para después de la migración mesa_vertical.
// Los tamaños de mesa del plano cambiaron: las posiciones guardadas con la grilla
// vieja pueden pisarse, quedar fuera del lienzo o estar apiladas en (50, 30).
//
// Por sucursal recorre las mesas activas por número y deja donde están las que
// entran en el lienzo y no pisan a una ya conservada; las demás van al primer
// lugar libre. Una mesa con reserva ACTIVA no se mueve (solo se avisa). No toca
// capacidad, activa ni vertical. Es idempotente: una segunda corrida no mueve nada.
//
// Uso (desde la raíz, con DATABASE_URL apuntando a la base que corresponda):
//   npm run db:reubicar-mesas -w @pgim/api              simulacro: solo imprime
//   npm run db:reubicar-mesas -w @pgim/api -- --aplicar escribe, una transacción por sucursal
// Orden de despliegue: correrlo en staging y, después de db:deploy, en producción.
import { prisma } from '../src/lib/prisma';
import { planificarReubicacion } from '../src/domain/reubicacion-mesas';

const formato = (p: { posX: number; posY: number }) => `(${p.posX}, ${p.posY})`;

async function main() {
  const aplicar = process.argv.includes('--aplicar');
  console.log(
    aplicar ? 'Reubicando mesas (se escribe en la base).' : 'SIMULACRO: no se escribe nada.',
  );

  const sucursales = await prisma.sucursal.findMany({
    include: { restaurante: { select: { nombre: true } } },
    orderBy: [{ restauranteId: 'asc' }, { nombre: 'asc' }],
  });

  let movidas = 0;
  let avisadas = 0;
  for (const sucursal of sucursales) {
    const mesas = await prisma.mesa.findMany({
      where: { sucursalId: sucursal.id, activa: true },
      orderBy: { numero: 'asc' },
    });
    if (mesas.length === 0) continue;

    const activas = await prisma.reserva.findMany({
      where: { sucursalId: sucursal.id, estado: 'ACTIVA', mesaId: { in: mesas.map((m) => m.id) } },
      select: { mesaId: true },
    });
    const { movimientos, avisos } = planificarReubicacion(
      mesas.map((m) => ({
        id: m.id,
        numero: m.numero,
        capacidad: m.capacidad,
        vertical: m.vertical,
        posX: Number(m.posX),
        posY: Number(m.posY),
      })),
      new Set(activas.map((r) => r.mesaId)),
    );
    if (movimientos.length === 0 && avisos.length === 0) continue;

    const donde = `${sucursal.restaurante.nombre} / ${sucursal.nombre}`;
    for (const mov of movimientos) {
      console.log(
        `${donde}: mesa ${mov.numero} ${aplicar ? 'se movió' : 'se movería'} de ${formato(mov.desde)} a ${formato(mov.hasta)}`,
      );
    }
    for (const aviso of avisos) {
      console.log(
        `${donde}: mesa ${aviso.numero} NO se mueve (${
          aviso.motivo === 'RESERVA_ACTIVA'
            ? 'tiene una reserva activa'
            : 'no hay lugar libre en el salón'
        })`,
      );
    }

    if (aplicar && movimientos.length > 0) {
      await prisma.$transaction(
        movimientos.map((mov) =>
          prisma.mesa.update({
            where: { id: mov.id },
            data: { posX: mov.hasta.posX, posY: mov.hasta.posY },
          }),
        ),
      );
    }
    movidas += movimientos.length;
    avisadas += avisos.length;
  }

  console.log(
    `${aplicar ? 'Listo' : 'Simulacro listo'}: ${movidas} mesas ${aplicar ? 'movidas' : 'por mover'}, ${avisadas} avisos.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
