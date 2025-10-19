import React, { useState, useEffect } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Card, Button, Input, Modal } from '../components/common';
import { PersonasTable } from '../components/personas/PersonasTable';
import { PersonaForm } from '../components/personas/PersonaForm';
import { personasService } from '../services/personasService';
import { useToast } from '../hooks/useToast';
import type { Persona, PersonaFormData } from '../types';

export const PersonasPage: React.FC = () => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'cliente' | 'proveedor'>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona | undefined>();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [personaToDelete, setPersonaToDelete] = useState<Persona | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const toast = useToast();

  // Cargar personas
  const loadPersonas = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      if (filterType === 'cliente') {
        params.es_cliente = true;
      } else if (filterType === 'proveedor') {
        params.es_proveedor = true;
      }
      
      const response = await personasService.getAll(params);
      setPersonas(response.results || response);
    } catch (error: any) {
      console.error('Error al cargar personas:', error);
      toast.error('Error al cargar las personas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, [searchTerm, filterType]);

  // Handlers
  const handleCreate = () => {
    setSelectedPersona(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (persona: Persona) => {
    setSelectedPersona(persona);
    setIsModalOpen(true);
  };

  const handleDelete = (persona: Persona) => {
    setPersonaToDelete(persona);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (data: PersonaFormData) => {
    try {
      setIsSubmitting(true);
      
      if (selectedPersona) {
        // Actualizar
        await personasService.update(selectedPersona.id, data);
        toast.success('Persona actualizada correctamente');
      } else {
        // Crear
        await personasService.create(data);
        toast.success('Persona creada correctamente');
      }
      
      setIsModalOpen(false);
      setSelectedPersona(undefined);
      loadPersonas();
    } catch (error: any) {
      console.error('Error al guardar persona:', error);
      const errorMessage = error.response?.data?.message || 'Error al guardar la persona';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!personaToDelete) return;
    
    try {
      await personasService.delete(personaToDelete.id);
      toast.success('Persona eliminada correctamente');
      setIsDeleteModalOpen(false);
      setPersonaToDelete(null);
      loadPersonas();
    } catch (error: any) {
      console.error('Error al eliminar persona:', error);
      toast.error('Error al eliminar la persona');
    }
  };

  const filteredPersonas = personas.filter(persona => {
    const matchesSearch = persona.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         persona.numero_documento.includes(searchTerm);
    
    const matchesFilter = filterType === 'all' || 
                         (filterType === 'cliente' && persona.es_cliente) ||
                         (filterType === 'proveedor' && persona.es_proveedor);
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Users className="h-8 w-8 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestión de Personas</h1>
            <p className="text-gray-600">Administra clientes y proveedores</p>
          </div>
        </div>
      </div>

      {/* Filtros y acciones */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Búsqueda */}
          <div className="flex-1 w-full">
            <Input
              placeholder="Buscar por nombre o documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-5 w-5" />}
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="input"
            >
              <option value="all">Todos</option>
              <option value="cliente">Clientes</option>
              <option value="proveedor">Proveedores</option>
            </select>
          </div>

          {/* Botón crear */}
          <Button
            variant="primary"
            icon={<Plus className="h-5 w-5" />}
            onClick={handleCreate}
          >
            Nueva Persona
          </Button>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        <PersonasTable
          personas={filteredPersonas}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        
        {!isLoading && filteredPersonas.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Mostrando {filteredPersonas.length} persona{filteredPersonas.length !== 1 ? 's' : ''}
          </div>
        )}
      </Card>

      {/* Modal de Formulario */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPersona(undefined);
        }}
        title={selectedPersona ? 'Editar Persona' : 'Nueva Persona'}
        size="lg"
      >
        <PersonaForm
          persona={selectedPersona}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedPersona(undefined);
          }}
          isLoading={isSubmitting}
        />
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPersonaToDelete(null);
        }}
        title="Confirmar Eliminación"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            ¿Estás seguro de que deseas eliminar a <strong>{personaToDelete?.nombre}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setPersonaToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
