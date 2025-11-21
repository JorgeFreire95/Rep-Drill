from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from authentication.models import Role
import secrets


class Command(BaseCommand):
    help = (
        "Crea o actualiza un usuario administrador. "
        "Si el usuario existe, puede actualizar flags y (opcionalmente) resetear la contraseña.\n\n"
        "Ejemplos:\n"
        "  python manage.py create_admin --email admin@repdrill.com --password admin123\n"
        "  python manage.py create_admin --email admin@repdrill.com --first-name Admin --last-name RepDrill --random-password\n"
        "  python manage.py create_admin --email admin@repdrill.com --reset-password --password NuevoPass123\n"
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True, help='Email del administrador a crear/actualizar')
        parser.add_argument('--password', help='Contraseña del administrador')
        parser.add_argument('--first-name', default='Admin', help='Nombre (por defecto: Admin)')
        parser.add_argument('--last-name', default='User', help='Apellido (por defecto: User)')
        parser.add_argument('--reset-password', action='store_true', help='Forzar reseteo de contraseña si el usuario existe')
        parser.add_argument('--random-password', action='store_true', help='Genera una contraseña aleatoria y la muestra por pantalla')

    def handle(self, *args, **options):
        User = get_user_model()

        email = options['email'].strip().lower()
        password = options.get('password')
        first_name = options['first_name']
        last_name = options['last_name']
        reset_password = options['reset_password']
        random_password = options['random_password']

        # Generar password aleatoria si se solicita
        if random_password:
            password = secrets.token_urlsafe(16)

        # Validaciones básicas
        if not password and not reset_password and not random_password:
            raise CommandError('Debe especificar --password o usar --random-password')

        # Asegurar que el rol admin exista
        admin_role, _ = Role.objects.get_or_create(name='admin', defaults={'description': 'Administrador del sistema'})

        # Crear o actualizar usuario
        try:
            user = User.objects.filter(email=email).first()
            if user:
                changed = False
                # Actualizar datos básicos si cambian
                if user.first_name != first_name:
                    user.first_name = first_name
                    changed = True
                if user.last_name != last_name:
                    user.last_name = last_name
                    changed = True
                # Flags de admin
                if not user.is_staff:
                    user.is_staff = True
                    changed = True
                if not user.is_superuser:
                    user.is_superuser = True
                    changed = True
                if not user.is_active:
                    user.is_active = True
                    changed = True
                if not user.is_verified:
                    user.is_verified = True
                    changed = True
                # Rol admin
                if user.role_id != admin_role.id:
                    user.role = admin_role
                    changed = True
                # Resetear contraseña si corresponde
                if reset_password and password:
                    user.set_password(password)
                    changed = True

                if changed:
                    user.save()
                    self.stdout.write(self.style.SUCCESS(f'Usuario admin actualizado: {email}'))
                else:
                    self.stdout.write(self.style.NOTICE(f'Usuario admin ya estaba configurado correctamente: {email}'))

            else:
                user = User.objects.create_superuser(
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    role=admin_role,
                    is_verified=True,
                )
                self.stdout.write(self.style.SUCCESS(f'Usuario admin creado: {email}'))

            # Mostrar contraseña generada (si aplica)
            if random_password:
                self.stdout.write(self.style.WARNING(f"Contraseña generada para {email}: {password}"))

        except Exception as exc:
            raise CommandError(f'Error creando/actualizando admin: {exc}')
