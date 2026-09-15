"use client";

import { useState, useEffect } from "react";
import {
  listarClientesConPedidos,
  listarPedidosCliente,
  generarFacturaDesdePedido,
} from "@/actions/facturas";

interface Cliente {
  email: string;
  nombre: string;
  usuario_id: string | null;
  nif_cif: string | null;
  tipo_cliente: string;
  num_pedidos: number;
  total_gastado: number;
  ultimo_pedido: string;
}

interface Pedido {
  id: string;
  estado: string;
  total: number;
  created_at: string;
  metodo_pago: string | null;
  email_cliente: string;
}

export default function FacturasAdmin() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState("");

  const [numeroFactura, setNumeroFactura] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      setCargandoClientes(true);
      const data = await listarClientesConPedidos();
      setClientes(data);
      setCargandoClientes(false);
    }
    cargar();
  }, []);

  async function seleccionarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setPedidoSeleccionado("");
    setNumeroFactura("");
    setError(null);
    setExito(null);

    setCargandoPedidos(true);
    const data = await listarPedidosCliente(cliente.email);
    setPedidos(data);
    setCargandoPedidos(false);
  }

  async function handleGenerar(e: React.FormEvent) {
    e.preventDefault();
    if (!pedidoSeleccionado || !numeroFactura.trim() || !clienteSeleccionado) return;

    setGenerando(true);
    setError(null);
    setExito(null);

    const res = await generarFacturaDesdePedido(
      pedidoSeleccionado,
      clienteSeleccionado.usuario_id || clienteSeleccionado.email,
      numeroFactura.trim()
    );

    setGenerando(false);

    if (res.error) {
      setError(res.error);
    } else {
      setExito(`Factura ${numeroFactura} generada correctamente.`);
      setNumeroFactura("");
      setPedidoSeleccionado("");
    }
  }

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatEuros(n: number) {
    return n.toFixed(2).replace(".", ",") + " €";
  }

  const clientesFiltrados = busqueda
    ? clientes.filter(
        (c) =>
          c.email.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (c.nif_cif ?? "").toLowerCase().includes(busqueda.toLowerCase())
      )
    : clientes;

  return (
    <div>
      <h1
        className="text-2xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Facturas
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        Genera facturas para cualquier cliente (profesional o particular).
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Columna izquierda: selector de cliente */}
        <div>
          <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
            1. Seleccionar cliente
          </h2>

          {/* Buscador */}
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por email, nombre o NIF..."
            className="w-full border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors rounded mb-4"
          />

          {cargandoClientes ? (
            <p className="text-sm text-neutral-400">Cargando clientes...</p>
          ) : (
            <div className="border border-neutral-200 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              {clientesFiltrados.length === 0 ? (
                <p className="p-4 text-sm text-neutral-400">Sin resultados</p>
              ) : (
                clientesFiltrados.map((c) => (
                  <button
                    key={c.email}
                    onClick={() => seleccionarCliente(c)}
                    className={`w-full text-left px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
                      clienteSeleccionado?.email === c.email
                        ? "bg-[#C4857A]/10 border-l-2 border-l-[#C4857A]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {c.nombre || c.email}
                        </p>
                        {c.nombre && (
                          <p className="text-xs text-neutral-500">{c.email}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded ${
                            c.tipo_cliente === "b2b"
                              ? "bg-[#C4857A]/10 text-[#7A4A40]"
                              : "bg-neutral-100 text-neutral-500"
                          }`}
                        >
                          {c.tipo_cliente === "b2b" ? "Profesional" : "Particular"}
                        </span>
                        <p className="text-xs text-neutral-400 mt-1">
                          {c.num_pedidos} pedido{c.num_pedidos !== 1 ? "s" : ""} · {formatEuros(c.total_gastado)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Columna derecha: selector de pedido y generación */}
        <div>
          <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
            2. Generar factura
          </h2>

          {!clienteSeleccionado ? (
            <div className="border border-dashed border-neutral-300 rounded-lg p-8 text-center">
              <p className="text-sm text-neutral-400">
                Selecciona un cliente de la lista para ver sus pedidos.
              </p>
            </div>
          ) : (
            <form onSubmit={handleGenerar} className="space-y-4">
              {/* Info del cliente seleccionado */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-neutral-900">
                    {clienteSeleccionado.nombre || clienteSeleccionado.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setClienteSeleccionado(null);
                      setPedidos([]);
                      setPedidoSeleccionado("");
                    }}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Cambiar
                  </button>
                </div>
                {clienteSeleccionado.nif_cif && (
                  <p className="text-xs text-neutral-500">
                    NIF/CIF: {clienteSeleccionado.nif_cif}
                  </p>
                )}
                <p className="text-xs text-neutral-500">{clienteSeleccionado.email}</p>
              </div>

              {/* Selector de pedido */}
              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Pedido
                </label>
                {cargandoPedidos ? (
                  <p className="text-sm text-neutral-400">Cargando pedidos...</p>
                ) : pedidos.length === 0 ? (
                  <p className="text-sm text-neutral-400">Sin pedidos</p>
                ) : (
                  <select
                    value={pedidoSeleccionado}
                    onChange={(e) => setPedidoSeleccionado(e.target.value)}
                    required
                    className="w-full border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors rounded bg-white"
                  >
                    <option value="">— Selecciona un pedido —</option>
                    {pedidos.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.id.slice(0, 8).toUpperCase()} · {formatFecha(p.created_at)} · {formatEuros(p.total)} · {p.estado}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Número de factura */}
              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Número de factura
                </label>
                <input
                  type="text"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="Ej: EB-2026-0533"
                  required
                  className="w-full border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors rounded"
                />
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={generando || !pedidoSeleccionado || !numeroFactura.trim()}
                className="w-full px-5 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded"
              >
                {generando ? "Generando..." : "Generar factura"}
              </button>
            </form>
          )}

          {/* Mensajes */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}
          {exito && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded">
              ✓ {exito}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
