import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Phone, Mail, User } from 'lucide-react';
import { personasService } from '../../services/personasService';
import { useToast } from '../../hooks/useToast';
import type { Persona } from '../../types';
import './CustomerSearchBox.css';
import { logger } from '../../utils/logger';

interface CustomerSearchBoxProps {
  onSelectCustomer: (customer: Persona) => void;
  placeholder?: string;
}

export const CustomerSearchBox: React.FC<CustomerSearchBoxProps> = ({
  onSelectCustomer,
  placeholder = 'Buscar cliente por teléfono, email o nombre...',
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [results, setResults] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Búsqueda con debounce
  useEffect(() => {
    const performSearch = async (query: string) => {
      try {
        setIsLoading(true);
        setSelectedIndex(-1);

        // Determinar tipo de búsqueda
        const searchParams: { phone?: string; email?: string; name?: string; limit: number } = { limit: 50 };

        // Detectar si es teléfono, email o nombre
        if (/^\+?[\d\s\-()]+$/.test(query)) {
          // Es teléfono
          searchParams.phone = query;
        } else if (query.includes('@')) {
          // Es email
          searchParams.email = query;
        } else {
          // Es nombre
          searchParams.name = query;
        }

        const response = await personasService.searchCustomers(searchParams);

        if (response.count > 0) {
          setResults(response.results);
          setShowResults(true);
        } else {
          setResults([]);
          setShowResults(true); // Mostrar mensaje de "sin resultados"
        }
      } catch (error: unknown) {
        logger.error('Error buscando clientes:', error);
        toast.error('Error al buscar clientes');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      if (searchValue.length >= 2) {
        performSearch(searchValue);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timer);
  }, [searchValue, toast]);

  // Cerrar resultados al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Persona) => {
    onSelectCustomer(customer);
    setSearchValue('');
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    setSearchValue('');
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  // Navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelectCustomer(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={searchBoxRef} className="customer-search-box">
      {/* Input de búsqueda */}
      <div className="search-input-container">
        <Search className="search-icon" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="search-input"
          autoComplete="off"
        />
        {searchValue && (
          <button onClick={handleClear} className="clear-button" title="Limpiar búsqueda">
            <X className="clear-icon" />
          </button>
        )}
        {isLoading && <div className="loading-spinner" />}
      </div>

      {/* Dropdown de resultados */}
      {showResults && (
        <div className="search-results">
          {isLoading ? (
            <div className="loading-message">Buscando clientes...</div>
          ) : results.length > 0 ? (
            <>
              <div className="results-header">
                <span className="results-count">
                  {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ul className="results-list">
                {results.map((customer, index) => (
                  <li
                    key={customer.id}
                    className={`result-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <div className="result-header">
                      <div className="customer-name">
                        <User className="icon" />
                        <span className="name">{customer.nombre}</span>
                      </div>
                      <span className="customer-type">
                        {customer.es_cliente && <span className="badge-cliente">Cliente</span>}
                      </span>
                    </div>
                    <div className="result-details">
                      {customer.telefono && (
                        <div className="detail">
                          <Phone className="icon" />
                          <span>{customer.telefono}</span>
                        </div>
                      )}
                      {customer.email && (
                        <div className="detail">
                          <Mail className="icon" />
                          <span>{customer.email}</span>
                        </div>
                      )}
                    </div>
                    {customer.direccion && (
                      <div className="result-address">
                        <small>{customer.direccion}</small>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="no-results">
              <p>❌ No se encontraron clientes</p>
              <small>Intenta con otro teléfono, email o nombre</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
